from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import log_audit
from ..database import get_db
from ..deps import get_client_ip, get_current_user
from ..models import User
from ..schemas import FirstLoginPassword, ForgotPasswordRequest, LoginRequest, PasswordChange
from ..security import create_access_token, hash_password, verify_password
from ..serialize import user_brief

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.post("/login")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    ident = payload.get_login_identifier()
    client_ip = get_client_ip(request)

    if not ident or not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide both username/email and password.",
        )

    user = db.scalar(
        select(User).where(
            or_(
                func.lower(User.email) == ident,
                func.lower(User.username) == ident,
            )
        )
    )

    # 1. Rate limiting / account lock check
    now = datetime.now()
    if user and user.locked_until and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds() / 60) + 1
        log_audit(
            db,
            actor_id=user.id,
            action="auth.login_locked",
            category="auth",
            description=f"Locked account login attempt for {ident} from {client_ip}",
            entity_type="user",
            entity_id=user.id,
            ip_address=client_ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account is temporarily locked due to multiple failed login attempts. Please try again in {remaining} minute(s) or contact your administrator.",
        )

    # 2. Check credentials
    if user is None or not verify_password(payload.password, user.password_hash):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            db.commit()

        log_audit(
            db,
            actor_id=user.id if user else None,
            action="auth.login_failed",
            category="auth",
            description=f"Failed login attempt for identifier '{ident}' from {client_ip}",
            entity_type="user",
            entity_id=user.id if user else None,
            ip_address=client_ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password. Please try again.",
        )

    # 3. Check account activation & status
    if not user.is_active or getattr(user, "status", "active") != "active":
        status_label = getattr(user, "status", "inactive")
        log_audit(
            db,
            actor_id=user.id,
            action="auth.login_blocked",
            category="auth",
            description=f"Login attempt on {status_label} account for {ident} from {client_ip}",
            entity_type="user",
            entity_id=user.id,
            ip_address=client_ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is {status_label}. Please contact your administrator.",
        )

    # 4. Success - reset lockouts and record login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    user.last_login_ip = client_ip

    token_ver = user.token_version or 1
    token = create_access_token(user.id, user.role, payload.remember, token_version=token_ver)

    log_audit(
        db,
        actor_id=user.id,
        action="auth.login_success",
        category="auth",
        description=f"User {user.name} ({user.email}) logged in successfully from {client_ip}",
        entity_type="user",
        entity_id=user.id,
        ip_address=client_ip,
    )
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_brief(user),
        "must_change_password": bool(user.must_change_password),
    }


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_brief(user)


@router.post("/change-password")
def change_password(
    request: Request,
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="The new password must be different from the current password.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    # Invalidate other existing sessions
    user.token_version = (user.token_version or 1) + 1
    db.commit()

    log_audit(
        db,
        actor_id=user.id,
        action="auth.password_changed",
        category="auth",
        description=f"User {user.name} changed their password from {client_ip}",
        entity_type="user",
        entity_id=user.id,
        ip_address=client_ip,
    )
    db.commit()
    return {"message": "Password updated successfully. Please sign in again with your new credentials."}


@router.post("/first-login-password")
def first_login_password(
    request: Request,
    payload: FirstLoginPassword,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match.")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.token_version = (user.token_version or 1) + 1
    db.commit()

    new_token = create_access_token(user.id, user.role, remember=False, token_version=user.token_version)

    log_audit(
        db,
        actor_id=user.id,
        action="auth.first_login_password_set",
        category="auth",
        description=f"User {user.name} set permanent password on first login from {client_ip}",
        entity_type="user",
        entity_id=user.id,
        ip_address=client_ip,
    )
    db.commit()

    return {
        "message": "Permanent password successfully set.",
        "access_token": new_token,
        "token_type": "bearer",
        "user": user_brief(user),
    }


@router.post("/forgot-password")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    ident = payload.username_or_email.strip().lower()
    user = db.scalar(
        select(User).where(
            or_(
                func.lower(User.email) == ident,
                func.lower(User.username) == ident,
            )
        )
    )

    if user:
        log_audit(
            db,
            actor_id=user.id,
            action="auth.forgot_password_requested",
            category="auth",
            description=f"Password reset assistance requested for {user.name} ({user.email}) from {client_ip}",
            entity_type="user",
            entity_id=user.id,
            ip_address=client_ip,
        )
        db.commit()

    return {
        "message": "If an account matches those details, your administrator has been notified to assist you with a password reset."
    }

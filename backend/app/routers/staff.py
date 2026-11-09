import json
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import log_audit
from ..database import get_db
from ..deps import get_client_ip, require_admin
from ..models import Attendance, Call, Client, FollowUp, Lead, Proposal, User
from ..schemas import StaffCreate, StaffPasswordReset, StaffUpdate
from ..security import hash_password
from ..serialize import user_brief
from ..utils import next_code, paginate

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("")
def list_staff(
    q: str | None = None,
    status: str | None = None,
    role: str | None = None,
    department: str | None = None,
    page: int = 1,
    page_size: int = 10,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.name.ilike(term),
                User.email.ilike(term),
                User.username.ilike(term),
                User.staff_code.ilike(term),
                User.department.ilike(term),
                User.designation.ilike(term),
            )
        )
    if status and status != "all":
        stmt = stmt.where(User.status == status)
    if role and role != "all":
        stmt = stmt.where(User.role == role)
    if department and department != "all":
        stmt = stmt.where(User.department == department)

    stmt = stmt.order_by(User.role.asc(), User.name.asc())

    lead_counts = dict(
        db.execute(
            select(Lead.assigned_staff_id, func.count(Lead.id)).group_by(Lead.assigned_staff_id)
        ).all()
    )
    call_counts = dict(
        db.execute(select(Call.staff_id, func.count(Call.id)).group_by(Call.staff_id)).all()
    )
    result = paginate(db, stmt, page, page_size)
    items = []
    for member in result["items"]:
        data = user_brief(member)
        data["lead_count"] = int(lead_counts.get(member.id, 0))
        data["call_count"] = int(call_counts.get(member.id, 0))
        items.append(data)
    return {**result, "items": items}


@router.post("", status_code=201)
def create_staff(
    request: Request,
    payload: StaffCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    email = payload.email.strip().lower()
    username = payload.username.strip().lower()

    if payload.temporary_password != payload.confirm_temporary_password:
        raise HTTPException(status_code=400, detail="Temporary password and confirmation do not match.")

    # Validate unique email
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status_code=409, detail="A user with this work email already exists.")

    # Validate unique username
    if db.scalar(select(User).where(func.lower(User.username) == username)):
        raise HTTPException(status_code=409, detail="A user with this username already exists.")

    code = payload.staff_code.strip().upper() if payload.staff_code else next_code(db, "ST")
    if payload.staff_code:
        if db.scalar(select(User).where(User.staff_code == code)):
            raise HTTPException(status_code=409, detail="Employee ID / Staff code is already in use.")

    perms_json = json.dumps(payload.permissions) if payload.permissions else None
    is_active = (payload.status == "active")

    member = User(
        staff_code=code,
        username=username,
        name=payload.name.strip(),
        email=email,
        phone=payload.phone.strip() if payload.phone else None,
        designation=payload.designation.strip() if payload.designation else None,
        department=payload.department.strip() if payload.department else None,
        role=payload.role,
        status=payload.status,
        is_active=is_active,
        must_change_password=payload.must_change_password,
        token_version=1,
        password_hash=hash_password(payload.temporary_password),
        permissions=perms_json,
        joined_on=payload.joined_on or date.today(),
        created_at=datetime.now(),
    )
    db.add(member)
    db.flush()

    log_audit(
        db,
        actor_id=admin.id,
        action="staff.created",
        category="staff",
        description=f"Staff account created for {member.name} ({member.email}, {member.staff_code}) with role {member.role}",
        entity_type="user",
        entity_id=member.id,
        entity_ref=member.staff_code,
        new_state={
            "name": member.name,
            "username": member.username,
            "email": member.email,
            "designation": member.designation,
            "department": member.department,
            "role": member.role,
            "status": member.status,
        },
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(member)
    return user_brief(member)


@router.get("/{staff_id}")
def get_staff(
    staff_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    member = db.get(User, staff_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    return user_brief(member)


@router.patch("/{staff_id}")
def update_staff(
    staff_id: int,
    payload: StaffUpdate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    member = db.get(User, staff_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Staff member not found.")

    data = payload.model_dump(exclude_unset=True)
    prev_state = {
        "name": member.name,
        "username": member.username,
        "email": member.email,
        "designation": member.designation,
        "department": member.department,
        "role": member.role,
        "status": member.status,
        "is_active": member.is_active,
    }

    # Validate email
    if data.get("email"):
        email = str(data["email"]).strip().lower()
        existing = db.scalar(select(User).where(func.lower(User.email) == email, User.id != member.id))
        if existing:
            raise HTTPException(status_code=409, detail="A user with this email already exists.")
        data["email"] = email

    # Validate username
    if data.get("username"):
        username = str(data["username"]).strip().lower()
        existing = db.scalar(select(User).where(func.lower(User.username) == username, User.id != member.id))
        if existing:
            raise HTTPException(status_code=409, detail="A user with this username already exists.")
        data["username"] = username

    # Validate staff_code
    if data.get("staff_code"):
        code = str(data["staff_code"]).strip().upper()
        existing = db.scalar(select(User).where(User.staff_code == code, User.id != member.id))
        if existing:
            raise HTTPException(status_code=409, detail="Employee ID / Staff code is already in use.")
        data["staff_code"] = code

    # Safety: admin cannot deactivate or demote self
    if member.id == admin.id:
        if data.get("status") in {"inactive", "suspended"} or data.get("is_active") is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate or suspend your own administrator account.")
        if data.get("role") == "staff":
            raise HTTPException(status_code=400, detail="You cannot change your own admin role.")

    # Permissions update
    perms_changed = False
    if "permissions" in data:
        perms_val = data.pop("permissions")
        member.permissions = json.dumps(perms_val) if perms_val else None
        perms_changed = True
        # Invalidate active sessions immediately on permission changes
        member.token_version = (member.token_version or 1) + 1

    # Status & active handling
    status_changed = False
    if "status" in data:
        new_status = data["status"]
        member.status = new_status
        member.is_active = (new_status == "active")
        status_changed = True
        if new_status != "active":
            # Invalidate session immediately
            member.token_version = (member.token_version or 1) + 1
        else:
            member.failed_login_attempts = 0
            member.locked_until = None
        data.pop("status")
        data.pop("is_active", None)

    for field, value in data.items():
        setattr(member, field, value)

    new_state = {
        "name": member.name,
        "username": member.username,
        "email": member.email,
        "designation": member.designation,
        "department": member.department,
        "role": member.role,
        "status": member.status,
        "is_active": member.is_active,
    }

    action_label = "staff.permissions_updated" if perms_changed else ("staff.status_changed" if status_changed else "staff.updated")
    log_audit(
        db,
        actor_id=admin.id,
        action=action_label,
        category="staff",
        description=f"Staff account for {member.name} ({member.staff_code}) updated by {admin.name}",
        entity_type="user",
        entity_id=member.id,
        entity_ref=member.staff_code,
        previous_state=prev_state,
        new_state=new_state,
        ip_address=client_ip,
    )
    db.commit()
    db.refresh(member)
    return user_brief(member)


@router.post("/{staff_id}/reset-password")
def admin_reset_password(
    staff_id: int,
    payload: StaffPasswordReset,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin resets staff password with a new temporary password.
    Admin can NEVER view existing passwords.
    Forces password change on next staff login and invalidates existing sessions.
    """
    client_ip = get_client_ip(request)
    member = db.get(User, staff_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Staff member not found.")

    member.password_hash = hash_password(payload.temporary_password)
    member.must_change_password = payload.require_password_change
    # Invalidate existing active sessions immediately
    member.token_version = (member.token_version or 1) + 1
    # Clear any lockout
    member.failed_login_attempts = 0
    member.locked_until = None

    log_audit(
        db,
        actor_id=admin.id,
        action="staff.password_reset",
        category="staff",
        description=f"Admin {admin.name} reset password for staff {member.name} ({member.staff_code}). Temporary password issued.",
        entity_type="user",
        entity_id=member.id,
        entity_ref=member.staff_code,
        ip_address=client_ip,
    )
    db.commit()
    return {"message": f"Temporary password set for {member.name}. They will be prompted to change it upon login."}


@router.post("/{staff_id}/toggle-status")
def toggle_status(
    staff_id: int,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    member = db.get(User, staff_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    if member.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    new_status = "inactive" if member.status == "active" else "active"
    member.status = new_status
    member.is_active = (new_status == "active")
    member.token_version = (member.token_version or 1) + 1

    if new_status == "active":
        member.failed_login_attempts = 0
        member.locked_until = None

    log_audit(
        db,
        actor_id=admin.id,
        action="staff.status_changed",
        category="staff",
        description=f"Admin {admin.name} set {member.name} ({member.staff_code}) status to {new_status}",
        entity_type="user",
        entity_id=member.id,
        entity_ref=member.staff_code,
        ip_address=client_ip,
    )
    db.commit()
    return user_brief(member)


@router.get("/{staff_id}/performance")
def staff_performance(
    staff_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    member = db.get(User, staff_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    now = datetime.now()
    thirty_days_ago = now - timedelta(days=30)

    lead_total = int(db.scalar(select(func.count(Lead.id)).where(Lead.assigned_staff_id == staff_id)) or 0)
    lead_status_rows = db.execute(
        select(Lead.status, func.count(Lead.id))
        .where(Lead.assigned_staff_id == staff_id)
        .group_by(Lead.status)
    ).all()
    lead_status = {status: int(total) for status, total in lead_status_rows}

    call_total = int(db.scalar(select(func.count(Call.id)).where(Call.staff_id == staff_id)) or 0)
    call_recent = int(
        db.scalar(
            select(func.count(Call.id)).where(
                Call.staff_id == staff_id, Call.called_at >= thirty_days_ago
            )
        )
        or 0
    )
    outcome_rows = db.execute(
        select(Call.outcome, func.count(Call.id))
        .where(Call.staff_id == staff_id)
        .group_by(Call.outcome)
    ).all()
    outcomes = {outcome: int(total) for outcome, total in outcome_rows}

    follow_total = int(
        db.scalar(select(func.count(FollowUp.id)).where(FollowUp.staff_id == staff_id)) or 0
    )
    follow_done = int(
        db.scalar(
            select(func.count(FollowUp.id)).where(
                FollowUp.staff_id == staff_id, FollowUp.status == "completed"
            )
        )
        or 0
    )
    present_days = int(
        db.scalar(
            select(func.count(Attendance.id)).where(
                Attendance.user_id == staff_id,
                Attendance.work_date >= thirty_days_ago.date(),
                Attendance.status.in_(["present", "half_day"]),
            )
        )
        or 0
    )
    proposals = int(
        db.scalar(select(func.count(Proposal.id)).where(Proposal.created_by_id == staff_id)) or 0
    )
    clients = int(
        db.scalar(select(func.count(Client.id)).where(Client.assigned_staff_id == staff_id)) or 0
    )

    return {
        "staff": user_brief(member),
        "leads": {"total": lead_total, "by_status": lead_status},
        "calls": {"total": call_total, "last_30_days": call_recent, "by_outcome": outcomes},
        "followups": {
            "total": follow_total,
            "completed": follow_done,
            "completion_rate": round(follow_done / follow_total * 100, 1) if follow_total else 0,
        },
        "attendance": {"present_days_last_30": present_days},
        "proposals": proposals,
        "clients": clients,
        "conversion_rate": round(lead_status.get("converted", 0) / lead_total * 100, 1)
        if lead_total
        else 0,
    }

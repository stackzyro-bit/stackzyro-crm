import json
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_audit
from ..constants import CRM_MODULES, DEFAULT_ADMIN_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, STAFF_PERMISSIONS
from ..database import get_db
from ..deps import get_client_ip, get_current_user, require_admin
from ..models import Setting, User
from ..schemas import CompanySettings, ProfileUpdate
from ..serialize import user_brief
from .meta import get_settings, get_staff_permissions

router = APIRouter(prefix="/api/settings", tags=["settings"])

COMPANY_KEYS = {
    "company_name",
    "company_tagline",
    "company_email",
    "company_phone",
    "company_website",
    "company_address",
    "company_logo",
    "proposal_footer",
}
PREFERENCE_KEYS = {
    "currency",
    "date_format",
    "timezone",
    "followup_reminder_days",
    "default_followup_method",
}
SECURITY_KEYS = {
    "max_login_attempts",
    "lockout_minutes",
    "session_timeout_mins",
    "require_strong_passwords",
}
ATTENDANCE_KEYS = {
    "work_hours_start",
    "work_hours_end",
    "grace_period_mins",
    "half_day_hours",
}
CRM_CONFIG_KEYS = {
    "default_lead_category",
    "auto_assign_leads",
    "require_call_outcome",
}
NOTIFICATION_KEYS = {
    "email_alerts_enabled",
    "followup_reminder_email",
    "daily_digest_email",
}


class PermissionsPayload(BaseModel):
    permissions: list[str]


class GenericSettingsPayload(BaseModel):
    settings: dict[str, str | int | float | bool | None]


def _serialize(db: Session, user: User) -> dict:
    values = get_settings(db)
    return {
        "company": {key: values.get(key) for key in COMPANY_KEYS},
        "preferences": {key: values.get(key) for key in PREFERENCE_KEYS},
        "security": {
            "max_login_attempts": int(values.get("max_login_attempts") or 5),
            "lockout_minutes": int(values.get("lockout_minutes") or 15),
            "session_timeout_mins": int(values.get("session_timeout_mins") or 60),
            "require_strong_passwords": (values.get("require_strong_passwords") or "true").lower() == "true",
        },
        "attendance": {
            "work_hours_start": values.get("work_hours_start") or "09:30",
            "work_hours_end": values.get("work_hours_end") or "18:30",
            "grace_period_mins": int(values.get("grace_period_mins") or 15),
            "half_day_hours": int(values.get("half_day_hours") or 4),
        },
        "crm": {
            "default_lead_category": values.get("default_lead_category") or "General",
            "auto_assign_leads": (values.get("auto_assign_leads") or "false").lower() == "true",
            "require_call_outcome": (values.get("require_call_outcome") or "true").lower() == "true",
        },
        "notifications": {
            "email_alerts_enabled": (values.get("email_alerts_enabled") or "true").lower() == "true",
            "followup_reminder_email": (values.get("followup_reminder_email") or "true").lower() == "true",
            "daily_digest_email": (values.get("daily_digest_email") or "false").lower() == "true",
        },
        "roles": [
            {
                "role": "admin",
                "label": "Administrator",
                "description": "Full access to all CRM modules, employee records, system settings, audit logs and approvals.",
                "permissions": DEFAULT_ADMIN_PERMISSIONS,
            },
            {
                "role": "staff",
                "label": "Staff Member",
                "description": "Scoped access to assigned leads, calls, meetings, follow-ups and permitted modules.",
                "permissions": DEFAULT_STAFF_PERMISSIONS,
            },
        ],
        "crm_modules": CRM_MODULES,
        "permissions": get_staff_permissions(db),
        "profile": user_brief(user),
        "sample_data": (values.get("sample_data") or "").lower() == "true",
        "database": "PostgreSQL" if "postgresql" in str(db.bind.url) else "SQLite",
    }


def _save(db: Session, key: str, value) -> None:
    row = db.get(Setting, key)
    if row is None:
        row = Setting(key=key, value=str(value) if value is not None else None)
        db.add(row)
    else:
        row.value = str(value) if value is not None else None


@router.get("")
def read_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _serialize(db, user)


@router.patch("/company")
def update_company(
    request: Request,
    payload: CompanySettings,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    data = payload.model_dump(exclude_unset=True)
    if data.get("company_logo") and len(data["company_logo"]) > 800_000:
        raise HTTPException(status_code=422, detail="Logo file is too large. Use an image under 500 KB.")
    for key, value in data.items():
        if key in COMPANY_KEYS:
            _save(db, key, value)
    db.commit()
    log_audit(
        db,
        actor_id=admin.id,
        action="settings.company_updated",
        category="settings",
        description=f"Company profile settings updated by {admin.name}",
        new_state=data,
        ip_address=client_ip,
    )
    db.commit()
    return _serialize(db, admin)


@router.patch("/preferences")
def update_preferences(
    request: Request,
    payload: CompanySettings,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key in PREFERENCE_KEYS:
            if value is None:
                continue
            _save(db, key, value)
    db.commit()
    log_audit(
        db,
        actor_id=admin.id,
        action="settings.preferences_updated",
        category="settings",
        description=f"System preferences updated by {admin.name}",
        new_state=data,
        ip_address=client_ip,
    )
    db.commit()
    return _serialize(db, admin)


@router.patch("/section/{section_name}")
def update_section(
    section_name: str,
    payload: GenericSettingsPayload,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    allowed_keys = {
        "security": SECURITY_KEYS,
        "attendance": ATTENDANCE_KEYS,
        "crm": CRM_CONFIG_KEYS,
        "notifications": NOTIFICATION_KEYS,
    }.get(section_name)

    if not allowed_keys:
        raise HTTPException(status_code=400, detail=f"Invalid settings section: {section_name}")

    for k, v in payload.settings.items():
        if k in allowed_keys:
            _save(db, k, v)
    db.commit()

    log_audit(
        db,
        actor_id=admin.id,
        action=f"settings.{section_name}_updated",
        category="settings",
        description=f"Settings for '{section_name}' updated by {admin.name}",
        new_state=payload.settings,
        ip_address=client_ip,
    )
    db.commit()
    return _serialize(db, admin)


@router.put("/permissions")
def update_permissions(
    payload: PermissionsPayload,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    invalid = [item for item in payload.permissions if item not in STAFF_PERMISSIONS]
    if invalid:
        raise HTTPException(status_code=422, detail="Unknown permission value.")
    _save(db, "staff_permissions", json.dumps(sorted(set(payload.permissions))))
    db.commit()
    return _serialize(db, admin)


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return _serialize(db, user)

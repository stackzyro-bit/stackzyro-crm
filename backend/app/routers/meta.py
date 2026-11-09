import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..constants import (
    ATTENDANCE_STATUSES,
    CALL_OUTCOMES,
    FOLLOWUP_METHODS,
    LEAD_SOURCES,
    LEAD_STATUSES,
    MEETING_STATUSES,
    MEETING_TYPES,
    PROJECT_STATUSES,
    PROPOSAL_STATUSES,
    PROPOSAL_TEMPLATES,
    STAFF_PERMISSIONS,
    CRM_MODULES,
)
from ..database import get_db
from ..deps import get_current_user
from ..models import Service, Setting, User
from ..serialize import user_brief

router = APIRouter(prefix="/api/meta", tags=["meta"])

DEFAULT_SETTINGS = {
    "company_name": "STACKZYRO",
    "company_tagline": "Turning Ideas Into Digital Solutions",
    "company_email": "hello@stackzyro.com",
    "company_phone": "+91 90000 12345",
    "company_website": "www.stackzyro.com",
    "company_address": "STACKZYRO Technologies, 4th Floor, Cyber Park, Bengaluru, India",
    "company_logo": "",
    "proposal_footer": "Thank you for considering STACKZYRO. We look forward to building with you.",
    "currency": "INR",
    "date_format": "dd MMM yyyy",
    "timezone": "Asia/Kolkata",
    "followup_reminder_days": 1,
    "default_followup_method": "call",
}


def get_settings(db: Session) -> dict:
    settings = dict(DEFAULT_SETTINGS)
    for row in db.scalars(select(Setting)).all():
        settings[row.key] = row.value
    return settings


def get_staff_permissions(db: Session) -> list[str]:
    raw = db.get(Setting, "staff_permissions")
    if not raw or not raw.value:
        return list(STAFF_PERMISSIONS)
    try:
        value = json.loads(raw.value)
        return [item for item in value if item in STAFF_PERMISSIONS]
    except json.JSONDecodeError:
        return list(STAFF_PERMISSIONS)


@router.get("")
def meta(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    services = db.scalars(select(Service).order_by(Service.name)).all()
    staff = db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.name)
    ).all()
    settings = get_settings(db)
    base_templates = [
        {
            "key": template["key"],
            "name": template["name"],
            "service": template["service"],
            "title": template["title"],
            "overview": template["overview"],
            "scope": template["scope"],
            "deliverables": template["deliverables"],
            "timeline": template["timeline"],
            "terms": template["terms"],
            "payment_terms": template["payment_terms"],
            "additional_costs": template["additional_costs"],
        }
        for template in PROPOSAL_TEMPLATES
    ]
    return {
        "services": [{"id": s.id, "name": s.name} for s in services],
        "staff": [user_brief(u) for u in staff],
        "lead_statuses": LEAD_STATUSES,
        "call_outcomes": CALL_OUTCOMES,
        "followup_methods": FOLLOWUP_METHODS,
        "proposal_statuses": PROPOSAL_STATUSES,
        "project_statuses": PROJECT_STATUSES,
        "meeting_types": MEETING_TYPES,
        "meeting_statuses": MEETING_STATUSES,
        "attendance_statuses": ATTENDANCE_STATUSES,
        "lead_sources": LEAD_SOURCES,
        "staff_permissions": get_staff_permissions(db),
        "crm_modules": CRM_MODULES,
        "proposal_templates": base_templates,
        "company": {
            "name": settings.get("company_name"),
            "tagline": settings.get("company_tagline"),
            "email": settings.get("company_email"),
            "phone": settings.get("company_phone"),
            "website": settings.get("company_website"),
            "address": settings.get("company_address"),
            "logo": settings.get("company_logo"),
            "currency": settings.get("currency"),
            "proposal_footer": settings.get("proposal_footer"),
        },
        "sample_data": (settings.get("sample_data") or "").lower() == "true",
        "database": "PostgreSQL" if "postgresql" in str(db.bind.url) else "SQLite",
        "current_user": user_brief(user),
    }

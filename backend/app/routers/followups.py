from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..database import get_db
from ..deps import get_current_user, require_permission
from ..models import FollowUp, Lead, User
from ..schemas import FollowUpCreate, FollowUpUpdate
from ..serialize import followup_dict
from ..timezone import ist_day_bounds_utc, now_utc_naive, to_ist, to_utc_naive, today_ist
from ..utils import day_bounds, log_activity, next_code, paginate, parse_date, require_found

router = APIRouter(prefix="/api/followups", tags=["follow-ups"])

FOLLOWUP_OPTIONS = (selectinload(FollowUp.lead), selectinload(FollowUp.staff))


def _sync_lead_followup(db: Session, lead_id: int) -> None:
    lead = db.get(Lead, lead_id)
    if lead is None:
        return
    next_pending = db.scalar(
        select(FollowUp.due_at)
        .where(FollowUp.lead_id == lead_id, FollowUp.status == "pending")
        .order_by(FollowUp.due_at)
        .limit(1)
    )
    lead.next_follow_up = next_pending


@router.get("")
def list_followups(
    view: str = "all",
    q: str | None = None,
    staff_id: int | None = None,
    method: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(require_permission("followups", "view")),
    db: Session = Depends(get_db),
):
    now = now_utc_naive()
    today = today_ist()
    start_today, end_today = ist_day_bounds_utc(today)

    stmt = select(FollowUp).options(*FOLLOWUP_OPTIONS)
    if user.role != "admin":
        stmt = stmt.where(FollowUp.staff_id == user.id)
    if staff_id:
        stmt = stmt.where(FollowUp.staff_id == staff_id)
    if method and method != "all":
        stmt = stmt.where(FollowUp.method == method)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            FollowUp.lead.has(
                or_(Lead.business_name.ilike(term), Lead.code.ilike(term), Lead.phone.ilike(term))
            )
        )

    if view == "today":
        stmt = stmt.where(
            FollowUp.status == "pending",
            FollowUp.due_at >= start_today,
            FollowUp.due_at <= end_today,
        )
    elif view == "upcoming":
        stmt = stmt.where(FollowUp.status == "pending", FollowUp.due_at > end_today)
    elif view == "overdue":
        stmt = stmt.where(FollowUp.status == "pending", FollowUp.due_at < now)
    elif view == "completed":
        stmt = stmt.where(FollowUp.status == "completed")
    elif view == "cancelled":
        stmt = stmt.where(FollowUp.status == "cancelled")

    start = parse_date(date_from)
    end = parse_date(date_to)
    if start:
        start_utc, _ = ist_day_bounds_utc(start)
        stmt = stmt.where(FollowUp.due_at >= start_utc)
    if end:
        _, end_utc = ist_day_bounds_utc(end)
        stmt = stmt.where(FollowUp.due_at <= end_utc)

    stmt = stmt.order_by(FollowUp.due_at.asc(), FollowUp.id.asc())
    result = paginate(db, stmt, page, page_size)

    base = [] if user.role == "admin" else [FollowUp.staff_id == user.id]
    counts = {
        "today": int(
            db.scalar(
                select(__import__("sqlalchemy").func.count(FollowUp.id)).where(
                    *base,
                    FollowUp.status == "pending",
                    FollowUp.due_at >= start_today,
                    FollowUp.due_at <= end_today,
                )
            )
            or 0
        ),
        "upcoming": int(
            db.scalar(
                select(__import__("sqlalchemy").func.count(FollowUp.id)).where(
                    *base, FollowUp.status == "pending", FollowUp.due_at > end_today
                )
            )
            or 0
        ),
        "overdue": int(
            db.scalar(
                select(__import__("sqlalchemy").func.count(FollowUp.id)).where(
                    *base, FollowUp.status == "pending", FollowUp.due_at < now
                )
            )
            or 0
        ),
        "completed": int(
            db.scalar(
                select(__import__("sqlalchemy").func.count(FollowUp.id)).where(
                    *base, FollowUp.status == "completed"
                )
            )
            or 0
        ),
        "pending": int(
            db.scalar(
                select(__import__("sqlalchemy").func.count(FollowUp.id)).where(
                    *base, FollowUp.status == "pending"
                )
            )
            or 0
        ),
    }
    return {
        **result,
        "items": [followup_dict(row) for row in result["items"]],
        "counts": counts,
    }


@router.post("", status_code=201)
def create_followup(
    payload: FollowUpCreate,
    user: User = Depends(require_permission("followups", "create")),
    db: Session = Depends(get_db),
):
    lead = db.get(Lead, payload.lead_id)
    require_found(lead, "Lead")
    if user.role != "admin" and lead.assigned_staff_id != user.id:
        raise HTTPException(
            status_code=403, detail="You can only schedule follow-ups for your own leads."
        )
    staff_id = payload.staff_id or lead.assigned_staff_id or user.id
    if user.role != "admin":
        staff_id = user.id

    due_at = to_utc_naive(payload.due_at)
    followup = FollowUp(
        code=next_code(db, "FU"),
        lead_id=lead.id,
        staff_id=staff_id,
        due_at=due_at,
        method=payload.method,
        notes=payload.notes,
        status="pending",
    )
    db.add(followup)
    _sync_lead_followup(db, lead.id)
    ist_display = to_ist(due_at)
    log_activity(
        db,
        actor_id=user.id,
        type="followup_scheduled",
        title=f"Follow-up scheduled with {lead.business_name}",
        description=f"{ist_display.strftime('%d %b %Y, %I:%M %p')} · {payload.method}" if ist_display else payload.method,
        entity_type="lead",
        entity_id=lead.id,
    )
    log_audit(
        db,
        actor_id=user.id,
        action="followup.created",
        category="followup",
        description=f"Follow-up {followup.code} scheduled for {lead.business_name} on {ist_display.strftime('%Y-%m-%d %H:%M') if ist_display else ''}",
        entity_type="followup",
        entity_id=lead.id,
        entity_ref=followup.code,
    )
    db.commit()
    db.refresh(followup)
    return followup_dict(followup)


@router.patch("/{followup_id}")
def update_followup(
    followup_id: int,
    payload: FollowUpUpdate,
    user: User = Depends(require_permission("followups", "edit")),
    db: Session = Depends(get_db),
):
    followup = db.scalar(
        select(FollowUp).options(*FOLLOWUP_OPTIONS).where(FollowUp.id == followup_id)
    )
    require_found(followup, "Follow-up")
    if user.role != "admin" and followup.staff_id != user.id:
        raise HTTPException(status_code=403, detail="You can only update your own follow-ups.")
    if followup.status in {"completed", "cancelled"} and payload.status is None:
        raise HTTPException(status_code=400, detail="This follow-up is already closed.")

    data = payload.model_dump(exclude_unset=True)
    if user.role != "admin":
        data.pop("staff_id", None)
    if "due_at" in data and data["due_at"] is not None:
        data["due_at"] = to_utc_naive(data["due_at"])
    if data.get("due_at") and followup.status == "pending":
        data["status"] = "pending"

    for field, value in data.items():
        setattr(followup, field, value)

    if data.get("status") == "completed":
        followup.completed_at = now_utc_naive()
        log_activity(
            db,
            actor_id=user.id,
            type="followup_completed",
            title=f"Follow-up completed with {followup.lead.business_name if followup.lead else 'lead'}",
            entity_type="followup",
            entity_id=followup.lead_id,
        )
        log_audit(
            db,
            actor_id=user.id,
            action="followup.completed",
            category="followup",
            description=f"Follow-up {followup.code} marked completed for {followup.lead.business_name if followup.lead else 'lead'}",
            entity_type="followup",
            entity_id=followup.id,
            entity_ref=followup.code,
        )
    if data.get("status") == "cancelled":
        followup.completed_at = None

    _sync_lead_followup(db, followup.lead_id)
    db.commit()
    db.refresh(followup)
    return followup_dict(followup)


@router.delete("/{followup_id}")
def delete_followup(
    followup_id: int,
    user: User = Depends(require_permission("followups", "delete")),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only an administrator can delete follow-ups.")
    followup = db.get(FollowUp, followup_id)
    require_found(followup, "Follow-up")
    lead_id = followup.lead_id
    db.delete(followup)
    db.flush()
    _sync_lead_followup(db, lead_id)
    db.commit()
    return {"message": "Follow-up deleted."}

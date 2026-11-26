from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..database import get_db
from ..deps import get_current_user, require_permission
from ..models import Lead, Meeting, User
from ..schemas import MeetingCreate, MeetingUpdate
from ..serialize import meeting_dict
from ..timezone import ist_day_bounds_utc, to_ist, to_utc_naive
from ..utils import log_activity, next_code, paginate, parse_date, require_found

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

MEETING_OPTIONS = (selectinload(Meeting.lead), selectinload(Meeting.staff))


@router.get("")
def list_meetings(
    q: str | None = None,
    status: str | None = None,
    staff_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(require_permission("meetings", "view")),
    db: Session = Depends(get_db),
):
    stmt = select(Meeting).options(*MEETING_OPTIONS).join(Lead, Meeting.lead_id == Lead.id)
    if user.role != "admin":
        stmt = stmt.where(Meeting.staff_id == user.id)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Lead.business_name.ilike(term), Meeting.code.ilike(term), Lead.contact_person.ilike(term))
        )
    if status and status != "all":
        stmt = stmt.where(Meeting.status == status)
    if staff_id:
        stmt = stmt.where(Meeting.staff_id == staff_id)
    start = parse_date(date_from)
    end = parse_date(date_to)
    if start:
        start_utc, _ = ist_day_bounds_utc(start)
        stmt = stmt.where(Meeting.scheduled_at >= start_utc)
    if end:
        _, end_utc = ist_day_bounds_utc(end)
        stmt = stmt.where(Meeting.scheduled_at <= end_utc)
    stmt = stmt.order_by(Meeting.scheduled_at.desc(), Meeting.id.desc())
    result = paginate(db, stmt, page, page_size)
    return {**result, "items": [meeting_dict(row) for row in result["items"]]}


@router.post("", status_code=201)
def create_meeting(
    payload: MeetingCreate,
    user: User = Depends(require_permission("meetings", "create")),
    db: Session = Depends(get_db),
):
    lead = db.get(Lead, payload.lead_id)
    require_found(lead, "Lead")
    if user.role != "admin" and lead.assigned_staff_id != user.id:
        raise HTTPException(
            status_code=403, detail="You can only schedule meetings for your assigned leads."
        )
    staff_id = payload.staff_id if user.role == "admin" else user.id
    staff_id = staff_id or lead.assigned_staff_id or user.id
    # The client sends the wall-clock time selected in the form; treat it as IST
    # and store the equivalent naive UTC value, which is the DB convention.
    scheduled_utc = to_utc_naive(payload.scheduled_at)
    scheduled_ist = to_ist(scheduled_utc)
    meeting = Meeting(
        code=next_code(db, "MT"),
        lead_id=lead.id,
        staff_id=staff_id,
        scheduled_at=scheduled_utc,
        duration_minutes=payload.duration_minutes,
        meeting_type=payload.meeting_type,
        location=payload.location,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(meeting)
    db.flush()
    log_activity(
        db,
        actor_id=user.id,
        type="meeting_scheduled",
        title=f"Meeting scheduled with {lead.business_name}",
        description=f"{meeting.code} · {scheduled_ist.strftime('%d %b %Y, %I:%M %p')} IST",
        entity_type="meeting",
        entity_id=meeting.id,
    )
    log_audit(
        db,
        actor_id=user.id,
        action="meeting.created",
        category="meeting",
        description=(
            f"Meeting {meeting.code} scheduled with {lead.business_name} on "
            f"{scheduled_ist.strftime('%Y-%m-%d %H:%M')} IST"
        ),
        entity_type="meeting",
        entity_id=meeting.id,
        entity_ref=meeting.code,
    )
    db.commit()
    db.refresh(meeting)
    return meeting_dict(meeting)


@router.patch("/{meeting_id}")
def update_meeting(
    meeting_id: int,
    payload: MeetingUpdate,
    user: User = Depends(require_permission("meetings", "edit")),
    db: Session = Depends(get_db),
):
    meeting = db.scalar(
        select(Meeting).options(*MEETING_OPTIONS).where(Meeting.id == meeting_id)
    )
    require_found(meeting, "Meeting")
    if user.role != "admin" and meeting.staff_id != user.id:
        raise HTTPException(status_code=403, detail="You can only update your own meetings.")
    data = payload.model_dump(exclude_unset=True)
    if user.role != "admin":
        data.pop("staff_id", None)
    if "scheduled_at" in data:
        if data["scheduled_at"] is None:
            # Never overwrite an existing meeting with an empty time.
            data.pop("scheduled_at")
        else:
            # Same contract as create: the incoming value is IST wall-clock time.
            data["scheduled_at"] = to_utc_naive(data["scheduled_at"])
    for field, value in data.items():
        setattr(meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return meeting_dict(meeting)


@router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: int,
    user: User = Depends(require_permission("meetings", "delete")),
    db: Session = Depends(get_db),
):
    if user.role != "admin" and not user.has_permission("meetings", "delete"):
        raise HTTPException(status_code=403, detail="Only an administrator can delete meetings.")
    meeting = db.get(Meeting, meeting_id)
    require_found(meeting, "Meeting")
    code = meeting.code
    db.delete(meeting)
    log_audit(
        db,
        actor_id=user.id,
        action="meeting.deleted",
        category="meeting",
        description=f"Meeting {code} deleted by {user.name}",
        entity_type="meeting",
        entity_id=meeting_id,
        entity_ref=code,
    )
    db.commit()
    return {"message": "Meeting deleted."}

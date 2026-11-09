from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..database import get_db
from ..deps import get_current_user, require_permission
from ..models import Call, FollowUp, Lead, User
from ..schemas import CallCreate
from ..serialize import call_dict
from ..utils import day_bounds, log_activity, next_code, paginate, parse_date, require_found

router = APIRouter(prefix="/api/calls", tags=["calls"])

OUTCOME_TO_LEAD_STATUS = {
    "interested": "interested",
    "not_interested": "not_interested",
    "accepted": "accepted",
    "proposal_required": "proposal_required",
    "do_not_contact": "not_interested",
}

CALL_OPTIONS = (selectinload(Call.lead), selectinload(Call.staff))


@router.get("")
def list_calls(
    q: str | None = None,
    outcome: str | None = None,
    staff_id: int | None = None,
    lead_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(require_permission("calls", "view")),
    db: Session = Depends(get_db),
):
    stmt = select(Call).options(*CALL_OPTIONS).join(Lead, Call.lead_id == Lead.id)
    if user.role != "admin":
        stmt = stmt.where(Call.staff_id == user.id)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Lead.business_name.ilike(term), Call.code.ilike(term), Lead.code.ilike(term))
        )
    if outcome and outcome != "all":
        stmt = stmt.where(Call.outcome == outcome)
    if staff_id:
        stmt = stmt.where(Call.staff_id == staff_id)
    if lead_id:
        stmt = stmt.where(Call.lead_id == lead_id)
    start = parse_date(date_from)
    end = parse_date(date_to)
    if start:
        stmt = stmt.where(Call.called_at >= datetime.combine(start, datetime.min.time()))
    if end:
        stmt = stmt.where(Call.called_at <= datetime.combine(end, datetime.max.time()))
    stmt = stmt.order_by(Call.called_at.desc(), Call.id.desc())

    result = paginate(db, stmt, page, page_size)
    outcomes = dict(
        db.execute(
            select(Call.outcome, __import__("sqlalchemy").func.count(Call.id))
            .where(*( [Call.staff_id == user.id] if user.role != "admin" else [] ))
            .group_by(Call.outcome)
        ).all()
    )
    return {
        **result,
        "items": [call_dict(row) for row in result["items"]],
        "outcome_summary": {key: int(value) for key, value in outcomes.items()},
    }


@router.post("", status_code=201)
def create_call(
    payload: CallCreate,
    user: User = Depends(require_permission("calls", "create")),
    db: Session = Depends(get_db),
):
    lead = db.get(Lead, payload.lead_id)
    require_found(lead, "Lead")
    if user.role != "admin" and lead.assigned_staff_id != user.id:
        raise HTTPException(
            status_code=403, detail="You can only record calls for leads assigned to you."
        )
    if lead.status == "converted":
        raise HTTPException(
            status_code=400,
            detail="This lead is already a client. Add the conversation as a meeting note instead.",
        )

    called_at = payload.called_at or datetime.now()
    call = Call(
        code=next_code(db, "CA"),
        lead_id=lead.id,
        staff_id=user.id,
        called_at=called_at,
        outcome=payload.outcome,
        notes=payload.notes,
        next_follow_up=payload.next_follow_up,
    )
    db.add(call)

    mapped_status = OUTCOME_TO_LEAD_STATUS.get(payload.outcome)
    if mapped_status:
        lead.status = mapped_status
    if payload.outcome == "do_not_contact":
        lead.next_follow_up = None
    elif payload.next_follow_up:
        lead.next_follow_up = payload.next_follow_up

    if payload.next_follow_up and payload.create_follow_up:
        db.add(
            FollowUp(
                code=next_code(db, "FU"),
                lead_id=lead.id,
                staff_id=lead.assigned_staff_id or user.id,
                due_at=payload.next_follow_up,
                method="call",
                notes=f"Follow-up scheduled from call {call.code}.",
                status="pending",
            )
        )

    log_activity(
        db,
        actor_id=user.id,
        type="call_completed",
        title=f"Call recorded with {lead.business_name}",
        description=f"{call.code} · Outcome: {payload.outcome.replace('_', ' ')}",
        entity_type="call",
        entity_id=lead.id,
    )
    log_audit(
        db,
        actor_id=user.id,
        action="call.created",
        category="call",
        description=f"Call record {call.code} created for lead {lead.business_name} ({lead.code}), outcome: {payload.outcome}",
        entity_type="call",
        entity_id=lead.id,
        entity_ref=call.code,
    )
    db.commit()
    db.refresh(call)
    return call_dict(call)


@router.delete("/{call_id}")
def delete_call(
    call_id: int,
    user: User = Depends(require_permission("calls", "delete")),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only an administrator can delete call records.")
    call = db.get(Call, call_id)
    require_found(call, "Call")
    db.delete(call)
    db.commit()
    return {"message": "Call record deleted."}

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..database import get_db
from ..deps import get_current_user, require_permission
from ..models import Client, Lead, Service, User
from ..schemas import LeadCreate, LeadUpdate
from ..serialize import lead_dict
from ..utils import (
    csv_escape,
    log_activity,
    next_code,
    paginate,
    parse_date,
    require_found,
)

router = APIRouter(prefix="/api/leads", tags=["leads"])

LEAD_OPTIONS = (
    selectinload(Lead.services),
    selectinload(Lead.assigned_staff),
    selectinload(Lead.created_by),
)


def _ensure_client(db: Session, lead: Lead, actor: User | None) -> Client:
    if lead.client is not None:
        return lead.client
    service_names = ", ".join(service.name for service in lead.services) or lead.category
    client = Client(
        code=next_code(db, "CT"),
        lead_id=lead.id,
        business_name=lead.business_name,
        contact_person=lead.contact_person,
        phone=lead.phone,
        email=lead.email,
        services=service_names,
        start_date=date.today(),
        project_status="in_progress",
        assigned_staff_id=lead.assigned_staff_id,
        notes="Converted from lead " + lead.code,
    )
    db.add(client)
    log_activity(
        db,
        actor_id=actor.id if actor else None,
        type="client_converted",
        title=f"{lead.business_name} converted to client",
        description=f"Lead {lead.code} confirmed as a client.",
        entity_type="client",
        entity_id=lead.id,
    )
    return client


def _build_query(
    user: User,
    q: str | None,
    status: str | None,
    staff_id: int | None,
    service_id: int | None,
    date_from: str | None,
    date_to: str | None,
    sort: str | None,
):
    stmt = select(Lead).options(*LEAD_OPTIONS)
    if user.role != "admin":
        stmt = stmt.where(Lead.assigned_staff_id == user.id)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Lead.business_name.ilike(term),
                Lead.contact_person.ilike(term),
                Lead.phone.ilike(term),
                Lead.code.ilike(term),
                Lead.category.ilike(term),
            )
        )
    if status and status != "all":
        stmt = stmt.where(Lead.status == status)
    if staff_id:
        stmt = stmt.where(Lead.assigned_staff_id == staff_id)
    if service_id:
        stmt = stmt.where(Lead.services.any(Service.id == service_id))
    start = parse_date(date_from)
    end = parse_date(date_to)
    if start:
        stmt = stmt.where(Lead.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        stmt = stmt.where(Lead.created_at <= datetime.combine(end, datetime.max.time()))
    if sort == "oldest":
        stmt = stmt.order_by(Lead.created_at.asc(), Lead.id.asc())
    elif sort == "followup":
        stmt = stmt.order_by(Lead.next_follow_up.asc().nulls_last(), Lead.created_at.desc())
    elif sort == "business":
        stmt = stmt.order_by(Lead.business_name.asc())
    else:
        stmt = stmt.order_by(Lead.created_at.desc(), Lead.id.desc())
    return stmt


@router.get("")
def list_leads(
    q: str | None = None,
    status: str | None = None,
    staff_id: int | None = None,
    service_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(require_permission("leads", "view")),
    db: Session = Depends(get_db),
):
    stmt = _build_query(user, q, status, staff_id, service_id, date_from, date_to, sort)
    result = paginate(db, stmt, page, page_size)
    return {**result, "items": [lead_dict(row) for row in result["items"]]}


@router.get("/export.csv")
def export_leads(
    q: str | None = None,
    status: str | None = None,
    staff_id: int | None = None,
    service_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    user: User = Depends(require_permission("leads", "export")),
    db: Session = Depends(get_db),
):
    stmt = _build_query(user, q, status, staff_id, service_id, date_from, date_to, "newest")
    rows = db.execute(stmt).scalars().all()
    header = [
        "Lead ID",
        "Business Name",
        "Contact Person",
        "Phone",
        "Email",
        "Location",
        "Category",
        "Interested Services",
        "Assigned Staff",
        "Lead Status",
        "Lead Source",
        "Next Follow-up",
        "Created At",
    ]
    lines = [",".join(header)]
    for lead in rows:
        lines.append(
            ",".join(
                csv_escape(value)
                for value in [
                    lead.code,
                    lead.business_name,
                    lead.contact_person,
                    lead.phone,
                    lead.email,
                    lead.location,
                    lead.category,
                    ", ".join(service.name for service in lead.services),
                    lead.assigned_staff.name if lead.assigned_staff else "Unassigned",
                    lead.status,
                    lead.source,
                    lead.next_follow_up.isoformat(sep=" ") if lead.next_follow_up else "",
                    lead.created_at.isoformat(sep=" "),
                ]
            )
        )
    return Response(
        content="\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="stackzyro-leads.csv"'},
    )


@router.get("/{lead_id}")
def get_lead(
    lead_id: int,
    user: User = Depends(require_permission("leads", "view")),
    db: Session = Depends(get_db),
):
    lead = db.scalar(select(Lead).options(*LEAD_OPTIONS).where(Lead.id == lead_id))
    require_found(lead, "Lead")
    if user.role != "admin" and lead.assigned_staff_id != user.id:
        raise HTTPException(status_code=403, detail="You can only view leads assigned to you.")
    return lead_dict(lead, detail=True)


@router.post("", status_code=201)
def create_lead(
    payload: LeadCreate,
    user: User = Depends(require_permission("leads", "create")),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude={"services"})
    if user.role != "admin":
        data["assigned_staff_id"] = user.id
    if data.get("assigned_staff_id"):
        assignee = db.get(User, data["assigned_staff_id"])
        if assignee is None or not assignee.is_active:
            raise HTTPException(status_code=422, detail="Selected staff member is not available.")
    if data.get("email") is not None:
        data["email"] = str(data["email"])
    services = []
    if payload.services:
        services = list(db.scalars(select(Service).where(Service.id.in_(payload.services))).all())
        if len(services) != len(set(payload.services)):
            raise HTTPException(status_code=422, detail="One or more selected services are invalid.")

    lead = Lead(code=next_code(db, "LD"), created_by_id=user.id, **data)
    lead.services = services
    db.add(lead)
    db.flush()
    log_activity(
        db,
        actor_id=user.id,
        type="lead_added",
        title=f"New lead added: {lead.business_name}",
        description=f"{lead.code} · {lead.category or 'General enquiry'}",
        entity_type="lead",
        entity_id=lead.id,
    )
    log_audit(
        db,
        actor_id=user.id,
        action="lead.created",
        category="lead",
        description=f"Lead created: {lead.business_name} ({lead.code}) by {user.name}",
        entity_type="lead",
        entity_id=lead.id,
        entity_ref=lead.code,
        new_state={"business_name": lead.business_name, "status": lead.status, "assigned_staff_id": lead.assigned_staff_id},
    )
    db.commit()
    db.refresh(lead)
    return lead_dict(lead, detail=True)


@router.patch("/{lead_id}")
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    user: User = Depends(require_permission("leads", "edit")),
    db: Session = Depends(get_db),
):
    lead = db.scalar(select(Lead).options(*LEAD_OPTIONS).where(Lead.id == lead_id))
    require_found(lead, "Lead")
    if user.role != "admin" and lead.assigned_staff_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit leads assigned to you.")

    data = payload.model_dump(exclude_unset=True)
    services = data.pop("services", None)
    if user.role != "admin":
        data.pop("assigned_staff_id", None)
    if data.get("email") is not None:
        data["email"] = str(data["email"])
    if "assigned_staff_id" in data and data["assigned_staff_id"]:
        assignee = db.get(User, data["assigned_staff_id"])
        if assignee is None or not assignee.is_active:
            raise HTTPException(status_code=422, detail="Selected staff member is not available.")

    new_status = data.get("status")
    for field, value in data.items():
        setattr(lead, field, value)
    if services is not None:
        lead.services = list(
            db.scalars(select(Service).where(Service.id.in_(services))).all()
        )

    if new_status == "converted":
        _ensure_client(db, lead, user)

    db.commit()
    db.refresh(lead)
    return lead_dict(lead, detail=True)


@router.post("/{lead_id}/convert")
def convert_lead(
    lead_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = db.scalar(select(Lead).options(*LEAD_OPTIONS).where(Lead.id == lead_id))
    require_found(lead, "Lead")
    if user.role != "admin" and lead.assigned_staff_id != user.id:
        raise HTTPException(status_code=403, detail="You can only convert leads assigned to you.")
    if lead.client is None:
        lead.status = "converted"
        _ensure_client(db, lead, user)
    db.commit()
    db.refresh(lead)
    return lead_dict(lead, detail=True)


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    user: User = Depends(require_permission("leads", "delete")),
    db: Session = Depends(get_db),
):
    if user.role != "admin" and not user.has_permission("leads", "delete"):
        raise HTTPException(status_code=403, detail="Permission required to delete leads.")
    lead = db.get(Lead, lead_id)
    require_found(lead, "Lead")
    business = lead.business_name
    lead_code = lead.code
    db.delete(lead)
    db.flush()
    log_activity(
        db,
        actor_id=user.id,
        type="lead_deleted",
        title=f"Lead deleted: {business}",
        entity_type="lead",
        entity_id=lead_id,
    )
    log_audit(
        db,
        actor_id=user.id,
        action="lead.deleted",
        category="lead",
        description=f"Lead {business} ({lead_code}) deleted by {user.name}",
        entity_type="lead",
        entity_id=lead_id,
        entity_ref=lead_code,
    )
    db.commit()
    return {"message": "Lead deleted."}

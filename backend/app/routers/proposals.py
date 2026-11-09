import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..constants import PROPOSAL_STATUSES, PROPOSAL_TEMPLATES
from ..database import get_db
from ..deps import get_current_user, require_permission
from ..models import Client, Lead, Proposal, ProposalTemplateModel, User
from ..pdf_generator import generate_proposal_pdf
from ..schemas import (
    ProposalPayload,
    ProposalTemplatePayload,
    ProposalTemplateUpdate,
    ProposalUpdate,
)
from ..serialize import money, proposal_dict
from ..utils import log_activity, next_code, paginate, require_found

router = APIRouter(prefix="/api/proposals", tags=["proposals"])

PROPOSAL_OPTIONS = (
    selectinload(Proposal.lead),
    selectinload(Proposal.created_by),
    selectinload(Proposal.client),
)


class DecisionPayload(BaseModel):
    status: str = Field(pattern="^(accepted|rejected)$")


def _template_model_to_dict(t: ProposalTemplateModel) -> dict:
    return {
        "key": t.key,
        "name": t.name,
        "service": t.service,
        "title": t.title,
        "overview": t.overview or "",
        "scope": json.loads(t.scope) if t.scope else [],
        "deliverables": json.loads(t.deliverables) if t.deliverables else [],
        "timeline": json.loads(t.timeline) if t.timeline else [],
        "tech_stack": json.loads(t.tech_stack) if t.tech_stack else [],
        "pricing": json.loads(t.pricing) if t.pricing else [],
        "payment_terms": t.payment_terms or "",
        "additional_costs": t.additional_costs or "",
        "terms": json.loads(t.terms) if t.terms else [],
        "support_terms": t.support_terms or "",
        "is_default": bool(t.is_default),
        "is_custom": True,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _get_all_templates(db: Session) -> list[dict]:
    db_templates = db.scalars(
        select(ProposalTemplateModel).order_by(ProposalTemplateModel.name)
    ).all()
    db_dict = {t.key: _template_model_to_dict(t) for t in db_templates}

    result = []
    seen_keys = set()
    for static_t in PROPOSAL_TEMPLATES:
        k = static_t["key"]
        seen_keys.add(k)
        if k in db_dict:
            result.append(db_dict[k])
        else:
            result.append(
                {
                    **static_t,
                    "tech_stack": static_t.get("tech_stack", []),
                    "support_terms": static_t.get("support_terms", ""),
                    "is_custom": False,
                    "is_default": False,
                }
            )

    for k, custom_t in db_dict.items():
        if k not in seen_keys:
            result.append(custom_t)

    return result


def _template_for(key: str | None, db: Session | None = None) -> dict:
    if db and key:
        db_tmpl = db.scalar(
            select(ProposalTemplateModel).where(ProposalTemplateModel.key == key)
        )
        if db_tmpl:
            return _template_model_to_dict(db_tmpl)
    matched = next((t for t in PROPOSAL_TEMPLATES if t["key"] == key), None)
    if matched:
        return matched
    return PROPOSAL_TEMPLATES[0]


def _permission_filter(user: User):
    return or_(
        Proposal.lead.has(Lead.assigned_staff_id == user.id),
        Proposal.created_by_id == user.id,
    )


def _default_content(lead: Lead, template: dict, amount: float) -> dict:
    requirements = [
        line.strip("-• ").strip()
        for line in (lead.requirements or "").splitlines()
        if line.strip()
    ]
    raw_overview = template.get("overview", "")
    try:
        overview = raw_overview.format(business=lead.business_name)
    except Exception:
        overview = raw_overview

    return {
        "overview": overview,
        "requirements": requirements,
        "scope": list(template.get("scope", [])),
        "deliverables": list(template.get("deliverables", [])),
        "timeline": list(template.get("timeline", [])),
        "tech_stack": list(template.get("tech_stack", [])),
        "pricing": [
            {
                "item": template.get("name", "Service Deliverable"),
                "description": f"Custom project execution for {lead.business_name}",
                "qty": 1,
                "rate": amount,
                "amount": amount,
            }
        ]
        if amount
        else list(template.get("pricing", [])),
        "subtotal": amount,
        "discount": 0,
        "tax_rate": 0,
        "total": amount,
        "payment_terms": template.get("payment_terms", ""),
        "additional_costs": template.get("additional_costs", ""),
        "support_terms": template.get("support_terms", ""),
        "terms": list(template.get("terms", [])),
        "valid_until": (date.today() + timedelta(days=30)).isoformat(),
        "client_location": lead.location or "",
        "client_email": lead.email or "",
        "client_phone": lead.phone or "",
    }


@router.get("/templates")
def list_templates(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_all_templates(db)


@router.get("/templates/{key}")
def get_template(
    key: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    templates = _get_all_templates(db)
    found = next((t for t in templates if t["key"] == key), None)
    if not found:
        raise HTTPException(status_code=404, detail="Template not found")
    return found


@router.post("/templates")
def create_template(
    payload: ProposalTemplatePayload,
    user: User = Depends(require_permission("settings", "edit")),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(ProposalTemplateModel).where(ProposalTemplateModel.key == payload.key)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Template with this key already exists.")

    new_t = ProposalTemplateModel(
        key=payload.key,
        name=payload.name,
        service=payload.service,
        title=payload.title,
        overview=payload.overview,
        scope=json.dumps(payload.scope),
        deliverables=json.dumps(payload.deliverables),
        timeline=json.dumps(payload.timeline),
        tech_stack=json.dumps(payload.tech_stack),
        pricing=json.dumps(payload.pricing),
        payment_terms=payload.payment_terms,
        additional_costs=payload.additional_costs,
        terms=json.dumps(payload.terms),
        support_terms=payload.support_terms,
        is_default=payload.is_default,
    )
    db.add(new_t)
    db.commit()
    db.refresh(new_t)

    log_audit(
        db,
        actor=user,
        action="create_proposal_template",
        category="templates",
        description=f"Created custom proposal template '{new_t.name}' ({new_t.key})",
        entity_type="proposal_template",
        entity_ref=new_t.key,
    )

    return _template_model_to_dict(new_t)


@router.patch("/templates/{key}")
def update_template(
    key: str,
    payload: ProposalTemplateUpdate,
    user: User = Depends(require_permission("settings", "edit")),
    db: Session = Depends(get_db),
):
    tmpl = db.scalar(select(ProposalTemplateModel).where(ProposalTemplateModel.key == key))
    if not tmpl:
        static_match = next((t for t in PROPOSAL_TEMPLATES if t["key"] == key), None)
        if not static_match:
            raise HTTPException(status_code=404, detail="Template not found.")
        tmpl = ProposalTemplateModel(
            key=key,
            name=static_match["name"],
            service=static_match["service"],
            title=static_match["title"],
            overview=static_match["overview"],
            scope=json.dumps(static_match.get("scope", [])),
            deliverables=json.dumps(static_match.get("deliverables", [])),
            timeline=json.dumps(static_match.get("timeline", [])),
            tech_stack=json.dumps(static_match.get("tech_stack", [])),
            pricing=json.dumps(static_match.get("pricing", [])),
            payment_terms=static_match.get("payment_terms", ""),
            additional_costs=static_match.get("additional_costs", ""),
            terms=json.dumps(static_match.get("terms", [])),
            support_terms=static_match.get("support_terms", ""),
            is_default=False,
        )
        db.add(tmpl)

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        if field in {"scope", "deliverables", "timeline", "tech_stack", "pricing", "terms"}:
            setattr(tmpl, field, json.dumps(val) if val is not None else None)
        else:
            setattr(tmpl, field, val)

    tmpl.updated_at = datetime.now()
    db.commit()
    db.refresh(tmpl)

    log_audit(
        db,
        actor=user,
        action="update_proposal_template",
        category="templates",
        description=f"Updated proposal template '{tmpl.name}' ({tmpl.key})",
        entity_type="proposal_template",
        entity_ref=tmpl.key,
    )

    return _template_model_to_dict(tmpl)


@router.post("/templates/{key}/duplicate")
def duplicate_template(
    key: str,
    user: User = Depends(require_permission("settings", "edit")),
    db: Session = Depends(get_db),
):
    all_templates = _get_all_templates(db)
    source = next((t for t in all_templates if t["key"] == key), None)
    if not source:
        raise HTTPException(status_code=404, detail="Source template not found.")

    new_key = f"{key}-copy-{int(datetime.now().timestamp())}"
    new_name = f"{source['name']} (Copy)"
    new_t = ProposalTemplateModel(
        key=new_key,
        name=new_name,
        service=source.get("service", "Custom Service"),
        title=f"{source.get('title', 'Proposal')} (Copy)",
        overview=source.get("overview", ""),
        scope=json.dumps(source.get("scope", [])),
        deliverables=json.dumps(source.get("deliverables", [])),
        timeline=json.dumps(source.get("timeline", [])),
        tech_stack=json.dumps(source.get("tech_stack", [])),
        pricing=json.dumps(source.get("pricing", [])),
        payment_terms=source.get("payment_terms", ""),
        additional_costs=source.get("additional_costs", ""),
        terms=json.dumps(source.get("terms", [])),
        support_terms=source.get("support_terms", ""),
        is_default=False,
    )
    db.add(new_t)
    db.commit()
    db.refresh(new_t)

    log_audit(
        db,
        actor=user,
        action="duplicate_proposal_template",
        category="templates",
        description=f"Duplicated template '{source['name']}' to '{new_name}' ({new_key})",
        entity_type="proposal_template",
        entity_ref=new_key,
    )

    return _template_model_to_dict(new_t)


@router.delete("/templates/{key}")
def delete_template(
    key: str,
    user: User = Depends(require_permission("settings", "edit")),
    db: Session = Depends(get_db),
):
    tmpl = db.scalar(select(ProposalTemplateModel).where(ProposalTemplateModel.key == key))
    if not tmpl:
        raise HTTPException(
            status_code=404,
            detail="Custom template not found or built-in templates cannot be deleted.",
        )
    db.delete(tmpl)
    db.commit()

    log_audit(
        db,
        actor=user,
        action="delete_proposal_template",
        category="templates",
        description=f"Deleted custom template '{tmpl.name}' ({tmpl.key})",
        entity_type="proposal_template",
        entity_ref=tmpl.key,
    )

    return {"message": "Template deleted successfully."}


@router.get("/stats")
def proposal_stats(
    user: User = Depends(require_permission("proposals", "view")),
    db: Session = Depends(get_db),
):
    stmt = select(Proposal.status, func.count(Proposal.id))
    if user.role != "admin":
        stmt = stmt.join(Lead, Proposal.lead_id == Lead.id).where(_permission_filter(user))
    stmt = stmt.group_by(Proposal.status)
    rows = db.execute(stmt).all()
    counts = {s: 0 for s in PROPOSAL_STATUSES}
    total = 0
    for st, count in rows:
        if st in counts:
            counts[st] = count
        total += count
    return {"total": total, **counts}


@router.get("")
def list_proposals(
    q: str | None = None,
    status: str | None = None,
    lead_id: int | None = None,
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(require_permission("proposals", "view")),
    db: Session = Depends(get_db),
):
    stmt = select(Proposal).options(*PROPOSAL_OPTIONS).join(Lead, Proposal.lead_id == Lead.id)
    if user.role != "admin":
        stmt = stmt.where(_permission_filter(user))
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Lead.business_name.ilike(term), Proposal.title.ilike(term), Proposal.code.ilike(term))
        )
    if status and status != "all":
        stmt = stmt.where(Proposal.status == status)
    if lead_id:
        stmt = stmt.where(Proposal.lead_id == lead_id)
    stmt = stmt.order_by(Proposal.created_at.desc(), Proposal.id.desc())
    result = paginate(db, stmt, page, page_size)
    return {**result, "items": [proposal_dict(row) for row in result["items"]]}


@router.get("/{proposal_id}")
def get_proposal(
    proposal_id: int,
    user: User = Depends(require_permission("proposals", "view")),
    db: Session = Depends(get_db),
):
    proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == proposal_id)
    )
    require_found(proposal, "Proposal")
    if user.role != "admin":
        lead = proposal.lead
        if proposal.created_by_id != user.id and (lead is None or lead.assigned_staff_id != user.id):
            raise HTTPException(status_code=403, detail="You can only view your own proposals.")
    return proposal_dict(proposal)


@router.get("/{proposal_id}/pdf")
def get_proposal_pdf(
    proposal_id: int,
    download: bool = False,
    user: User = Depends(require_permission("proposals", "view")),
    db: Session = Depends(get_db),
):
    proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == proposal_id)
    )
    require_found(proposal, "Proposal")
    if user.role != "admin":
        lead = proposal.lead
        if proposal.created_by_id != user.id and (lead is None or lead.assigned_staff_id != user.id):
            raise HTTPException(status_code=403, detail="You can only view your own proposals.")

    pdf_bytes = generate_proposal_pdf(proposal, db)
    disposition = "attachment" if download else "inline"
    safe_title = "".join(c for c in proposal.title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    filename = f"{proposal.code}_{safe_title[:30]}.pdf" if safe_title else f"{proposal.code}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Content-Type": "application/pdf",
        },
    )


@router.post("/{proposal_id}/approve")
def approve_proposal(
    proposal_id: int,
    user: User = Depends(require_permission("proposals", "approve")),
    db: Session = Depends(get_db),
):
    proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == proposal_id)
    )
    require_found(proposal, "Proposal")
    if proposal.status == "approved":
        return proposal_dict(proposal)

    proposal.status = "approved"
    log_activity(
        db,
        actor_id=user.id,
        type="proposal_approved",
        title=f"Proposal approved: {proposal.lead.business_name if proposal.lead else 'client'}",
        description=f"{proposal.code} · {proposal.title}",
        entity_type="proposal",
        entity_id=proposal.id,
    )
    log_audit(
        db,
        actor_id=user.id,
        action="proposal.approved",
        category="proposal",
        description=f"Proposal {proposal.code} approved: {proposal.title}",
        entity_type="proposal",
        entity_id=proposal.id,
        entity_ref=proposal.code,
    )
    db.commit()
    db.refresh(proposal)
    return proposal_dict(proposal)


@router.post("", status_code=201)
def create_proposal(
    payload: ProposalPayload,
    user: User = Depends(require_permission("proposals", "create")),
    db: Session = Depends(get_db),
):
    if not payload.lead_id and not payload.client_id:
        raise HTTPException(status_code=422, detail="Either lead_id or client_id must be provided.")

    lead = None
    client = None
    if payload.lead_id:
        lead = db.get(Lead, payload.lead_id)
        require_found(lead, "Lead")
        client = lead.client
    elif payload.client_id:
        client = db.get(Client, payload.client_id)
        require_found(client, "Client")
        if client.lead_id:
            lead = db.get(Lead, client.lead_id)
        else:
            lead = Lead(
                code=next_code(db, "LD"),
                business_name=client.business_name,
                contact_person=client.contact_person,
                phone=client.phone,
                email=client.email,
                status="converted",
                created_by_id=user.id,
            )
            db.add(lead)
            db.flush()
            client.lead_id = lead.id

    if user.role != "admin" and lead.assigned_staff_id != user.id and (not client or client.assigned_staff_id != user.id):
        raise HTTPException(status_code=403, detail="You can only create proposals for your leads or clients.")

    template = _template_for(payload.template_key, db)
    content = payload.content or _default_content(lead, template, payload.amount)
    proposal = Proposal(
        code=next_code(db, "PR"),
        lead_id=lead.id,
        client_id=client.id if client else (lead.client.id if lead.client else None),
        title=payload.title,
        service_type=payload.service_type or template["service"],
        status=payload.status,
        amount=payload.amount,
        template_key=payload.template_key or template["key"],
        content=json.dumps(content),
        created_by_id=user.id,
        sent_at=datetime.now() if payload.status == "sent" else None,
    )
    db.add(proposal)
    db.flush()
    log_activity(
        db,
        actor_id=user.id,
        type="proposal_created",
        title=f"Proposal created for {lead.business_name}",
        description=f"{proposal.code} · {proposal.title}",
        entity_type="proposal",
        entity_id=proposal.id,
    )
    log_audit(
        db,
        actor_id=user.id,
        action="proposal.created",
        category="proposal",
        description=f"Proposal {proposal.code} created for {lead.business_name}: {proposal.title} (Amount: {proposal.amount})",
        entity_type="proposal",
        entity_id=proposal.id,
        entity_ref=proposal.code,
    )
    db.commit()
    db.refresh(proposal)
    return proposal_dict(proposal)


@router.patch("/{proposal_id}")
def update_proposal(
    proposal_id: int,
    payload: ProposalUpdate,
    user: User = Depends(require_permission("proposals", "edit")),
    db: Session = Depends(get_db),
):
    proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == proposal_id)
    )
    require_found(proposal, "Proposal")
    if user.role != "admin" and proposal.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit proposals you created.")

    data = payload.model_dump(exclude_unset=True)
    content = data.pop("content", None)
    status_value = data.get("status")
    if status_value and status_value not in PROPOSAL_STATUSES:
        raise HTTPException(status_code=422, detail="Unknown proposal status.")

    if status_value in {"approved", "accepted"} and user.role != "admin" and not user.has_permission("proposals", "approve"):
        raise HTTPException(status_code=403, detail="Permission required to approve proposals.")

    for field, value in data.items():
        setattr(proposal, field, value)
    if content is not None:
        proposal.content = json.dumps(content)
        proposal.amount = content.get("total", proposal.amount)

    if status_value == "sent" and proposal.sent_at is None:
        proposal.sent_at = datetime.now()
        log_activity(
            db,
            actor_id=user.id,
            type="proposal_sent",
            title=f"Proposal sent to {proposal.lead.business_name if proposal.lead else 'client'}",
            description=f"{proposal.code} · {proposal.title}",
            entity_type="proposal",
            entity_id=proposal.id,
        )
    if status_value in {"accepted", "rejected"}:
        proposal.decided_at = datetime.now()
        log_activity(
            db,
            actor_id=user.id,
            type=f"proposal_{status_value}",
            title=f"Proposal {status_value}: {proposal.lead.business_name if proposal.lead else 'client'}",
            description=f"{proposal.code} · {proposal.title}",
            entity_type="proposal",
            entity_id=proposal.id,
        )
        if status_value == "accepted" and proposal.lead:
            proposal.lead.status = "accepted"

    db.commit()
    db.refresh(proposal)
    return proposal_dict(proposal)


@router.post("/{proposal_id}/send")
def send_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == proposal_id)
    )
    require_found(proposal, "Proposal")
    if user.role != "admin" and proposal.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="You can only send proposals you created.")
    if proposal.status not in {"draft", "pending_approval", "approved"}:
        raise HTTPException(
            status_code=400,
            detail="Only draft, pending or approved proposals can be marked as sent.",
        )
    proposal.status = "sent"
    proposal.sent_at = datetime.now()
    log_activity(
        db,
        actor_id=user.id,
        type="proposal_sent",
        title=f"Proposal sent to {proposal.lead.business_name if proposal.lead else 'client'}",
        description=f"{proposal.code} · {proposal.title}",
        entity_type="proposal",
        entity_id=proposal.id,
    )
    db.commit()
    db.refresh(proposal)
    return proposal_dict(proposal)


@router.post("/{proposal_id}/decision")
def record_decision(
    proposal_id: int,
    payload: DecisionPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == proposal_id)
    )
    require_found(proposal, "Proposal")
    if user.role != "admin" and proposal.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="You can only update proposals you created.")
    if proposal.status not in {"sent", "pending_approval", "approved"}:
        raise HTTPException(
            status_code=400, detail="Record a decision only for proposals that were sent."
        )
    proposal.status = payload.status
    proposal.decided_at = datetime.now()
    if payload.status == "accepted" and proposal.lead:
        proposal.lead.status = "accepted"
    log_activity(
        db,
        actor_id=user.id,
        type=f"proposal_{payload.status}",
        title=f"Proposal {payload.status}: {proposal.lead.business_name if proposal.lead else 'client'}",
        description=f"{proposal.code} · {proposal.title}",
        entity_type="proposal",
        entity_id=proposal.id,
    )
    db.commit()
    db.refresh(proposal)
    return proposal_dict(proposal)


@router.delete("/{proposal_id}")
def delete_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.get(Proposal, proposal_id)
    require_found(proposal, "Proposal")
    if user.role != "admin" and proposal.created_by_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete proposals you created.")
    db.delete(proposal)
    db.commit()
    return {"message": "Proposal deleted."}


@router.post("/{proposal_id}/duplicate")
def duplicate_proposal(
    proposal_id: int,
    user: User = Depends(require_permission("proposals", "create")),
    db: Session = Depends(get_db),
):
    proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == proposal_id)
    )
    require_found(proposal, "Proposal")
    code = next_code(db, "PR")
    new_proposal = Proposal(
        code=code,
        lead_id=proposal.lead_id,
        client_id=proposal.client_id,
        title=f"{proposal.title} (Copy)",
        service_type=proposal.service_type,
        status="draft",
        amount=proposal.amount,
        template_key=proposal.template_key,
        content=proposal.content,
        created_by_id=user.id,
    )
    db.add(new_proposal)
    db.commit()
    db.refresh(new_proposal)
    new_proposal = db.scalar(
        select(Proposal).options(*PROPOSAL_OPTIONS).where(Proposal.id == new_proposal.id)
    )
    log_activity(
        db,
        actor_id=user.id,
        type="proposal_created",
        title=f"Duplicated proposal {proposal.code} to {new_proposal.code}",
        description=new_proposal.title,
        entity_type="proposal",
        entity_id=new_proposal.id,
    )
    return proposal_dict(new_proposal)

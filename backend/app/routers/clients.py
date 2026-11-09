from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..database import get_db
from ..deps import get_current_user, require_permission
from ..models import Client, User
from ..schemas import ClientUpdate
from ..serialize import client_dict
from ..utils import paginate, require_found

router = APIRouter(prefix="/api/clients", tags=["clients"])

CLIENT_OPTIONS = (
    selectinload(Client.assigned_staff),
    selectinload(Client.lead),
)


@router.get("")
def list_clients(
    q: str | None = None,
    status: str | None = None,
    staff_id: int | None = None,
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(require_permission("clients", "view")),
    db: Session = Depends(get_db),
):
    stmt = select(Client).options(*CLIENT_OPTIONS)
    if user.role != "admin":
        stmt = stmt.where(Client.assigned_staff_id == user.id)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Client.business_name.ilike(term),
                Client.contact_person.ilike(term),
                Client.code.ilike(term),
                Client.email.ilike(term),
            )
        )
    if status and status != "all":
        stmt = stmt.where(Client.project_status == status)
    if staff_id:
        stmt = stmt.where(Client.assigned_staff_id == staff_id)
    stmt = stmt.order_by(Client.created_at.desc(), Client.id.desc())
    result = paginate(db, stmt, page, page_size)
    return {**result, "items": [client_dict(row) for row in result["items"]]}


@router.get("/{client_id}")
def get_client(
    client_id: int,
    user: User = Depends(require_permission("clients", "view")),
    db: Session = Depends(get_db),
):
    client = db.scalar(
        select(Client).options(*CLIENT_OPTIONS).where(Client.id == client_id)
    )
    require_found(client, "Client")
    if user.role != "admin" and client.assigned_staff_id != user.id:
        raise HTTPException(status_code=403, detail="You can only view clients assigned to you.")
    return client_dict(client)


@router.patch("/{client_id}")
def update_client(
    client_id: int,
    payload: ClientUpdate,
    user: User = Depends(require_permission("clients", "edit")),
    db: Session = Depends(get_db),
):
    if user.role != "admin" and not user.has_permission("clients", "edit"):
        raise HTTPException(status_code=403, detail="Permission required to edit client records.")
    client = db.get(Client, client_id)
    require_found(client, "Client")
    data = payload.model_dump(exclude_unset=True)
    if data.get("email") is not None:
        data["email"] = str(data["email"])
    for field, value in data.items():
        setattr(client, field, value)
    
    log_audit(
        db,
        actor_id=user.id,
        action="client.updated",
        category="client",
        description=f"Client {client.business_name} ({client.code}) updated by {user.name}",
        entity_type="client",
        entity_id=client.id,
        entity_ref=client.code,
    )
    db.commit()
    db.refresh(client)
    return client_dict(client)

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import require_admin
from ..models import AuditLog, User
from ..serialize import audit_log_dict
from ..utils import csv_escape, paginate, parse_date

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("")
def list_audit_logs(
    q: str | None = None,
    category: str | None = None,
    actor_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 15,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(AuditLog).options(selectinload(AuditLog.actor))

    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                AuditLog.action.ilike(term),
                AuditLog.description.ilike(term),
                AuditLog.entity_ref.ilike(term),
                AuditLog.ip_address.ilike(term),
            )
        )
    if category and category != "all":
        stmt = stmt.where(AuditLog.category == category)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)

    df = parse_date(date_from)
    if df:
        stmt = stmt.where(AuditLog.created_at >= datetime.combine(df, datetime.min.time()))
    dt = parse_date(date_to)
    if dt:
        stmt = stmt.where(AuditLog.created_at < datetime.combine(dt + timedelta(days=1), datetime.min.time()))

    stmt = stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())

    result = paginate(db, stmt, page, page_size)
    items = [audit_log_dict(row) for row in result["items"]]
    return {**result, "items": items}


@router.get("/export")
def export_audit_logs(
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(AuditLog).options(selectinload(AuditLog.actor))
    if category and category != "all":
        stmt = stmt.where(AuditLog.category == category)

    df = parse_date(date_from)
    if df:
        stmt = stmt.where(AuditLog.created_at >= datetime.combine(df, datetime.min.time()))
    dt = parse_date(date_to)
    if dt:
        stmt = stmt.where(AuditLog.created_at < datetime.combine(dt + timedelta(days=1), datetime.min.time()))

    stmt = stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(2000)
    rows = db.scalars(stmt).all()

    lines = ["Timestamp,Action,Category,User,Entity Type,Entity Ref,Description,IP Address"]
    for row in rows:
        actor_name = row.actor.name if row.actor else "System"
        lines.append(
            f"{csv_escape(row.created_at.isoformat())},"
            f"{csv_escape(row.action)},"
            f"{csv_escape(row.category)},"
            f"{csv_escape(actor_name)},"
            f"{csv_escape(row.entity_type or '')},"
            f"{csv_escape(row.entity_ref or '')},"
            f"{csv_escape(row.description)},"
            f"{csv_escape(row.ip_address or '')}"
        )
    csv_content = "\r\n".join(lines)
    filename = f"stackzyro_audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Activity, User
from ..serialize import activity_dict

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("")
def list_activities(
    limit: int = 12,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = min(max(limit, 1), 50)
    stmt = select(Activity).options(selectinload(Activity.actor))
    if user.role != "admin":
        stmt = stmt.where(Activity.actor_id == user.id)
    rows = db.scalars(
        stmt.order_by(Activity.created_at.desc(), Activity.id.desc()).limit(limit)
    ).all()
    return {"items": [activity_dict(row) for row in rows]}

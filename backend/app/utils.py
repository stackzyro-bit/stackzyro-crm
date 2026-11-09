from datetime import date, datetime, time
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Activity, Counter


def day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)
    return start, end


def parse_date(value: str | None) -> date | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date '{value}'. Expected YYYY-MM-DD.",
        )


def parse_datetime(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date/time '{value}'.",
        )


def next_code(db: Session, prefix: str) -> str:
    counter = db.get(Counter, prefix)
    if counter is None:
        counter = Counter(name=prefix, value=1)
        db.add(counter)
    else:
        counter.value += 1
    db.flush()
    return f"{prefix}-{counter.value:04d}"


def log_activity(
    db: Session,
    *,
    actor_id: int | None,
    type: str,
    title: str,
    description: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> None:
    db.add(
        Activity(
            actor_id=actor_id,
            type=type,
            title=title,
            description=description,
            entity_type=entity_type,
            entity_id=entity_id,
        )
    )


def paginate(db: Session, stmt, page: int = 1, page_size: int = 10) -> dict:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int(db.scalar(count_stmt) or 0)
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()
    pages = (total + page_size - 1) // page_size if total else 0
    return {"items": rows, "total": total, "page": page, "page_size": page_size, "pages": pages}


def money(value: Decimal | float | int | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def require_found(obj, label: str = "Record"):
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found.")
    return obj


def csv_escape(value) -> str:
    text = "" if value is None else str(value)
    if any(ch in text for ch in [",", '"', "\n", "\r"]):
        return '"' + text.replace('"', '""') + '"'
    return text

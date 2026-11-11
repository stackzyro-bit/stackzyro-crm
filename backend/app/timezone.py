"""Timezone configuration and helpers for STACKZYRO CRM.

The application standard is Asia/Kolkata (IST, UTC+05:30).
All persistent timestamps in the database are stored in UTC (naive),
and are converted to Asia/Kolkata for business day calculations,
API serialization, displays, and reporting exports.
"""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_utc() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


def now_utc_naive() -> datetime:
    """Return naive current UTC datetime for database storage."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now_ist() -> datetime:
    """Return timezone-aware current IST datetime."""
    return datetime.now(IST)


def today_ist() -> date:
    """Return the current calendar date in Asia/Kolkata (IST)."""
    return datetime.now(IST).date()


def to_ist(dt: datetime | None) -> datetime | None:
    """Convert a database UTC timestamp (naive or aware) to Asia/Kolkata."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # DB naive timestamps represent UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def to_utc_naive(dt: datetime | None) -> datetime | None:
    """
    Convert any datetime (aware or naive) into naive UTC datetime for DB storage.
    If naive, it is assumed to be in Asia/Kolkata (e.g. from user input).
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def format_iso_utc(dt: datetime | None) -> str | None:
    """Format a database datetime as ISO-8601 with explicit Z indicator (UTC)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def format_iso_ist(dt: datetime | None) -> str | None:
    """Format a UTC timestamp as an ISO-8601 string in Asia/Kolkata (+05:30)."""
    if dt is None:
        return None
    return to_ist(dt).isoformat()


def ist_day_bounds_utc(d: date) -> tuple[datetime, datetime]:
    """Return naive UTC start and end datetimes for an entire calendar day in IST.

    For example, 2026-11-11 in IST runs from 2026-11-11 00:00:00 to 23:59:59.999999.
    In UTC, this corresponds to 2026-11-10 18:30:00 to 2026-11-11 18:29:59.999999.
    """
    start = (
        datetime.combine(d, datetime.min.time())
        .replace(tzinfo=IST)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )
    end = (
        datetime.combine(d, datetime.max.time())
        .replace(tzinfo=IST)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )
    return start, end


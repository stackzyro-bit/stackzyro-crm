import csv
import io
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..constants import CHECK_OUT_REASONS
from ..database import get_db
from ..deps import get_current_user, require_admin, require_permission
from ..models import Attendance, AttendanceSession, User
from ..schemas import (
    CheckInPayload,
    CheckOutPayload,
    ResolveFlagPayload,
    SessionManualCreate,
    SessionManualEdit,
)
from ..serialize import _format_duration, attendance_dict, attendance_session_dict, user_brief
from ..timezone import (
    format_iso_ist,
    format_iso_utc,
    now_ist,
    now_utc_naive,
    to_ist,
    to_utc_naive,
    today_ist,
)
from ..utils import paginate, parse_date, require_found

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

ATTENDANCE_OPTIONS = (selectinload(Attendance.user),)
SESSION_OPTIONS = (selectinload(AttendanceSession.user), selectinload(AttendanceSession.corrected_by))


def _get_or_create_daily_attendance(db: Session, user_id: int, work_date: date) -> Attendance:
    record = db.scalar(
        select(Attendance).where(Attendance.user_id == user_id, Attendance.work_date == work_date)
    )
    if record is None:
        record = Attendance(
            user_id=user_id,
            work_date=work_date,
            status="present",
            total_working_seconds=0,
            total_break_seconds=0,
            exit_count=0,
            is_flagged=False,
        )
        db.add(record)
        db.flush()
    return record


def _recalculate_daily_metrics(db: Session, user_id: int, work_date: date) -> Attendance:
    """
    Recalculates total working seconds, total break seconds, and exit count
    from all sessions for that user on that date.
    """
    record = _get_or_create_daily_attendance(db, user_id, work_date)
    sessions = db.scalars(
        select(AttendanceSession)
        .where(AttendanceSession.user_id == user_id, AttendanceSession.work_date == work_date)
        .order_by(AttendanceSession.session_number.asc())
    ).all()

    if not sessions:
        record.check_in = None
        record.check_out = None
        record.total_working_seconds = 0
        record.total_break_seconds = 0
        record.exit_count = 0
        db.flush()
        return record

    total_working = 0
    total_break = 0
    exit_count = 0
    first_in = sessions[0].check_in
    latest_out = None

    for i, s in enumerate(sessions):
        # Calculate working seconds
        if s.check_in and s.check_out:
            w_sec = int((s.check_out - s.check_in).total_seconds())
            s.working_seconds = max(w_sec, 0)
            total_working += s.working_seconds
            exit_count += 1
            latest_out = s.check_out

        # Calculate break seconds from previous session
        if i > 0:
            prev = sessions[i - 1]
            if prev.check_out and s.check_in:
                b_sec = int((s.check_in - prev.check_out).total_seconds())
                s.break_seconds = max(b_sec, 0)
                total_break += s.break_seconds

    record.check_in = first_in
    record.check_out = latest_out
    record.total_working_seconds = total_working
    record.total_break_seconds = total_break
    record.exit_count = exit_count

    # Check if any session is flagged or missing checkout
    has_flag = any(s.status in {"flagged", "missing_checkout"} for s in sessions)
    record.is_flagged = has_flag
    if has_flag:
        flagged_s = next(s for s in sessions if s.status in {"flagged", "missing_checkout"})
        record.flag_reason = f"Session #{flagged_s.session_number}: Missing check-out or flagged for review."
    else:
        record.flag_reason = None

    # Status adjustment
    if total_working >= 14400:  # 4+ hours
        record.status = "present"
    elif total_working > 0 and record.check_out:
        record.status = "half_day"
    elif record.status not in {"absent", "leave"}:
        record.status = "present"

    db.flush()
    return record


def _get_today_status(db: Session, user: User, target_date: date | None = None) -> dict[str, Any]:
    today = target_date or today_ist()
    sessions = db.scalars(
        select(AttendanceSession)
        .options(*SESSION_OPTIONS)
        .where(AttendanceSession.user_id == user.id, AttendanceSession.work_date == today)
        .order_by(AttendanceSession.session_number.asc())
    ).all()

    active_session = next((s for s in sessions if s.status == "active" and s.check_out is None), None)

    if active_session:
        current_status = "checked_in"
    elif sessions:
        current_status = "checked_out"
    else:
        current_status = "not_started"

    daily_record = db.scalar(
        select(Attendance).where(Attendance.user_id == user.id, Attendance.work_date == today)
    )

    first_in = format_iso_utc(sessions[0].check_in) if sessions and sessions[0].check_in else None
    latest_session = sessions[-1] if sessions else None
    latest_in = format_iso_utc(latest_session.check_in) if latest_session and latest_session.check_in else None
    latest_out = (
        format_iso_utc(daily_record.check_out)
        if daily_record and daily_record.check_out
        else (format_iso_utc(latest_session.check_out) if latest_session and latest_session.check_out else None)
    )

    total_working = daily_record.total_working_seconds if daily_record else 0
    total_break = daily_record.total_break_seconds if daily_record else 0
    exit_count = daily_record.exit_count if daily_record else 0

    return {
        "work_date": today.isoformat(),
        "staff": user_brief(user),
        "current_status": current_status,
        "is_checked_in": current_status == "checked_in",
        "active_session": attendance_session_dict(active_session) if active_session else None,
        "first_check_in": first_in,
        "latest_check_in": latest_in,
        "latest_check_out": latest_out,
        "total_working_seconds": total_working,
        "working_duration": _format_duration(total_working),
        "total_break_seconds": total_break,
        "break_duration": _format_duration(total_break),
        "exit_count": exit_count,
        "completed_sessions_count": sum(1 for s in sessions if s.status == "completed"),
        "is_flagged": bool(daily_record.is_flagged) if daily_record else False,
        "flag_reason": daily_record.flag_reason if daily_record else None,
        "sessions": [attendance_session_dict(s) for s in sessions],
        "reasons_list": CHECK_OUT_REASONS,
    }


# =========================================================================
# LIVE CHECK-IN / CHECK-OUT ACTIONS
# =========================================================================

@router.get("/today-status")
def get_today_status(
    staff_id: int | None = None,
    user: User = Depends(require_permission("attendance", "view")),
    db: Session = Depends(get_db),
):
    target_user = user
    if staff_id and staff_id != user.id:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Staff can only view their own attendance status.")
        target_user = db.get(User, staff_id)
        require_found(target_user, "Staff member")

    return _get_today_status(db, target_user)


@router.post("/check-in")
def check_in(
    payload: CheckInPayload | None = None,
    user: User = Depends(require_permission("attendance", "create")),
    db: Session = Depends(get_db),
):
    now = now_utc_naive()
    today = today_ist()

    # 1. Check if user already has an active session today
    active_today = db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.user_id == user.id,
            AttendanceSession.work_date == today,
            AttendanceSession.status == "active",
            AttendanceSession.check_out.is_(None),
        )
    )
    if active_today:
        raise HTTPException(
            status_code=400,
            detail="You are currently checked in. Please check out first before checking in again.",
        )

    # 2. Check for forgotten open sessions from previous days
    lingering_sessions = db.scalars(
        select(AttendanceSession).where(
            AttendanceSession.user_id == user.id,
            AttendanceSession.work_date < today,
            AttendanceSession.status == "active",
            AttendanceSession.check_out.is_(None),
        )
    ).all()
    for ls in lingering_sessions:
        ls.status = "missing_checkout"
        # Flag daily attendance record
        prev_att = db.scalar(
            select(Attendance).where(Attendance.user_id == user.id, Attendance.work_date == ls.work_date)
        )
        if prev_att:
            prev_att.is_flagged = True
            prev_att.flag_reason = f"Session #{ls.session_number} was left open without checking out."
        log_audit(
            db,
            actor_id=user.id,
            action="attendance.missing_checkout_flagged",
            category="attendance",
            description=f"Session #{ls.session_number} on {ls.work_date} automatically flagged for missing check-out.",
            entity_type="attendance_session",
            entity_id=ls.id,
        )

    # 3. Determine new session number
    session_count = (
        db.scalar(
            select(func.count(AttendanceSession.id)).where(
                AttendanceSession.user_id == user.id, AttendanceSession.work_date == today
            )
        )
        or 0
    )
    new_session_num = session_count + 1

    # 4. Calculate break time since last session today
    break_seconds = 0
    last_session = db.scalar(
        select(AttendanceSession)
        .where(AttendanceSession.user_id == user.id, AttendanceSession.work_date == today)
        .order_by(AttendanceSession.session_number.desc())
    )
    if last_session and last_session.check_out:
        b_sec = int((now - last_session.check_out).total_seconds())
        break_seconds = max(b_sec, 0)

    # 5. Create new AttendanceSession
    new_session = AttendanceSession(
        user_id=user.id,
        work_date=today,
        session_number=new_session_num,
        check_in=now,
        check_in_note=payload.note if payload else None,
        break_seconds=break_seconds if break_seconds > 0 else None,
        status="active",
        is_manual=False,
    )
    db.add(new_session)
    db.flush()

    # 6. Recalculate daily metrics
    _recalculate_daily_metrics(db, user.id, today)

    # 7. Audit log
    log_audit(
        db,
        actor_id=user.id,
        action="attendance.check_in",
        category="attendance",
        description=f"Checked in for Session #{new_session_num} at {to_ist(now).strftime('%I:%M %p')}.",
        entity_type="attendance_session",
        entity_id=new_session.id,
        new_state={"session_number": new_session_num, "check_in": format_iso_ist(now)},
    )

    db.commit()
    return _get_today_status(db, user, today)


@router.post("/check-out")
def check_out(
    payload: CheckOutPayload,
    user: User = Depends(require_permission("attendance", "create")),
    db: Session = Depends(get_db),
):
    now = now_utc_naive()
    today = today_ist()

    # 1. Find active session
    session = db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.user_id == user.id,
            AttendanceSession.work_date == today,
            AttendanceSession.status == "active",
            AttendanceSession.check_out.is_(None),
        )
    )
    if session is None:
        raise HTTPException(
            status_code=400,
            detail="You are currently checked out. Please check in first before checking out.",
        )

    # 2. Validate reason
    clean_reason = payload.reason.strip()
    if clean_reason not in CHECK_OUT_REASONS and clean_reason != "End of Day":
        # Allow other reason if non-empty
        if not clean_reason:
            raise HTTPException(status_code=422, detail="A valid check-out reason is required.")

    # 3. Calculate working duration
    worked_sec = int((now - session.check_in).total_seconds())
    if worked_sec < 0:
        worked_sec = 0

    session.check_out = now
    session.check_out_reason = clean_reason
    session.check_out_note = payload.note.strip() if payload.note else None
    session.working_seconds = worked_sec
    session.status = "completed"

    # 4. Recalculate daily metrics
    _recalculate_daily_metrics(db, user.id, today)

    # 5. Audit log
    log_audit(
        db,
        actor_id=user.id,
        action="attendance.check_out",
        category="attendance",
        description=f"Checked out from Session #{session.session_number} ({clean_reason}) after {_format_duration(worked_sec)}.",
        entity_type="attendance_session",
        entity_id=session.id,
        new_state={
            "session_number": session.session_number,
            "check_out": format_iso_ist(now),
            "reason": clean_reason,
            "working_seconds": worked_sec,
        },
    )

    db.commit()
    return _get_today_status(db, user, today)


# =========================================================================
# ATTENDANCE TIMELINES & DAILY RECORDS
# =========================================================================

@router.get("/daily-timeline")
def get_daily_timeline(
    user_id: int,
    work_date: str,
    user: User = Depends(require_permission("attendance", "view")),
    db: Session = Depends(get_db),
):
    if user.role != "admin" and user.id != user_id:
        raise HTTPException(status_code=403, detail="Staff members can only view their own attendance timeline.")

    day = parse_date(work_date)
    if day is None:
        raise HTTPException(status_code=422, detail="Invalid date format. Expected YYYY-MM-DD.")

    staff = db.get(User, user_id)
    require_found(staff, "Staff member")

    daily_record = db.scalar(
        select(Attendance).where(Attendance.user_id == user_id, Attendance.work_date == day)
    )
    sessions = db.scalars(
        select(AttendanceSession)
        .options(*SESSION_OPTIONS)
        .where(AttendanceSession.user_id == user_id, AttendanceSession.work_date == day)
        .order_by(AttendanceSession.session_number.asc())
    ).all()

    total_working = daily_record.total_working_seconds if daily_record else 0
    total_break = daily_record.total_break_seconds if daily_record else 0
    exit_count = daily_record.exit_count if daily_record else 0

    return {
        "work_date": day.isoformat(),
        "staff": user_brief(staff),
        "attendance": attendance_dict(daily_record, sessions) if daily_record else None,
        "first_check_in": sessions[0].check_in.isoformat() if sessions and sessions[0].check_in else None,
        "latest_check_out": daily_record.check_out.isoformat() if daily_record and daily_record.check_out else None,
        "total_working_seconds": total_working,
        "working_duration": _format_duration(total_working),
        "total_break_seconds": total_break,
        "break_duration": _format_duration(total_break),
        "exit_count": exit_count,
        "sessions_count": len(sessions),
        "is_flagged": bool(daily_record.is_flagged) if daily_record else False,
        "flag_reason": daily_record.flag_reason if daily_record else None,
        "sessions": [attendance_session_dict(s) for s in sessions],
    }


@router.get("")
def list_attendance(
    work_date: str | None = None,
    staff_id: int | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    is_flagged: bool | None = None,
    page: int = 1,
    page_size: int = 10,
    user: User = Depends(require_permission("attendance", "view")),
    db: Session = Depends(get_db),
):
    stmt = select(Attendance).options(*ATTENDANCE_OPTIONS)
    if user.role != "admin":
        stmt = stmt.where(Attendance.user_id == user.id)
    if staff_id:
        stmt = stmt.where(Attendance.user_id == staff_id)
    day = parse_date(work_date)
    if day:
        stmt = stmt.where(Attendance.work_date == day)
    if status and status != "all":
        stmt = stmt.where(Attendance.status == status)
    if is_flagged is not None:
        stmt = stmt.where(Attendance.is_flagged == is_flagged)
    start = parse_date(date_from)
    end = parse_date(date_to)
    if start:
        stmt = stmt.where(Attendance.work_date >= start)
    if end:
        stmt = stmt.where(Attendance.work_date <= end)
    stmt = stmt.order_by(Attendance.work_date.desc(), Attendance.id.desc())
    result = paginate(db, stmt, page, page_size)

    # Attach sessions for the page
    items = []
    for row in result["items"]:
        sessions = db.scalars(
            select(AttendanceSession)
            .options(*SESSION_OPTIONS)
            .where(AttendanceSession.user_id == row.user_id, AttendanceSession.work_date == row.work_date)
            .order_by(AttendanceSession.session_number.asc())
        ).all()
        items.append(attendance_dict(row, sessions))

    return {**result, "items": items}


@router.get("/summary")
def attendance_summary(
    work_date: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = parse_date(work_date) or today_ist()
    total_staff = int(
        db.scalar(select(func.count(User.id)).where(User.role == "staff", User.is_active.is_(True))) or 0
    )

    rows = db.execute(
        select(Attendance.status, func.count(Attendance.id))
        .join(User, Attendance.user_id == User.id)
        .where(Attendance.work_date == day, User.role == "staff")
        .group_by(Attendance.status)
    ).all()
    counts = {s: int(tot) for s, tot in rows}
    present = counts.get("present", 0) + counts.get("half_day", 0)
    leave = counts.get("leave", 0)
    absent = max(total_staff - present - leave, 0)

    # Count staff currently in office vs on break
    active_now_count = int(
        db.scalar(
            select(func.count(AttendanceSession.id)).where(
                AttendanceSession.work_date == day,
                AttendanceSession.status == "active",
                AttendanceSession.check_out.is_(None),
            )
        )
        or 0
    )

    flagged_count = int(
        db.scalar(
            select(func.count(Attendance.id)).where(Attendance.work_date == day, Attendance.is_flagged.is_(True))
        )
        or 0
    )

    # Live board for all staff
    all_staff = db.scalars(
        select(User).where(User.role == "staff", User.is_active.is_(True)).order_by(User.name.asc())
    ).all()

    today_sessions = db.scalars(
        select(AttendanceSession)
        .options(*SESSION_OPTIONS)
        .where(AttendanceSession.work_date == day)
        .order_by(AttendanceSession.session_number.asc())
    ).all()
    sessions_by_user: dict[int, list[AttendanceSession]] = {}
    for s in today_sessions:
        sessions_by_user.setdefault(s.user_id, []).append(s)

    daily_attendance_rows = db.scalars(
        select(Attendance).where(Attendance.work_date == day)
    ).all()
    att_by_user = {a.user_id: a for a in daily_attendance_rows}

    live_board = []
    for staff in all_staff:
        st_sessions = sessions_by_user.get(staff.id, [])
        st_att = att_by_user.get(staff.id)
        active_sess = next((s for s in st_sessions if s.status == "active" and s.check_out is None), None)

        if active_sess:
            live_status = "working"
        elif st_sessions:
            last_reason = st_sessions[-1].check_out_reason or "Checked Out"
            live_status = "on_break"
        else:
            live_status = "not_checked_in"

        live_board.append({
            "staff": user_brief(staff),
            "live_status": live_status,
            "last_reason": st_sessions[-1].check_out_reason if st_sessions and not active_sess else None,
            "first_check_in": st_sessions[0].check_in.isoformat() if st_sessions else None,
            "latest_check_out": st_sessions[-1].check_out.isoformat() if st_sessions and st_sessions[-1].check_out else None,
            "total_working_seconds": st_att.total_working_seconds if st_att else 0,
            "working_duration": _format_duration(st_att.total_working_seconds) if st_att else "0m",
            "total_break_seconds": st_att.total_break_seconds if st_att else 0,
            "break_duration": _format_duration(st_att.total_break_seconds) if st_att else "0m",
            "exit_count": st_att.exit_count if st_att else 0,
            "is_flagged": bool(st_att.is_flagged) if st_att else False,
        })

    my_status = _get_today_status(db, user, day)

    return {
        "date": day.isoformat(),
        "present": present,
        "absent": absent,
        "leave": leave,
        "currently_working": active_now_count,
        "currently_on_break": max(present - active_now_count, 0),
        "total_staff": total_staff,
        "flagged_count": flagged_count,
        "records": counts,
        "live_board": live_board,
        "my_record": my_status,
    }


# =========================================================================
# FLAGGED SESSIONS & REVIEWS
# =========================================================================

@router.get("/flagged")
def get_flagged_sessions(
    user: User = Depends(require_permission("attendance", "view")),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can view flagged attendance sessions.")

    flagged_sessions = db.scalars(
        select(AttendanceSession)
        .options(*SESSION_OPTIONS)
        .where(AttendanceSession.status.in_(["missing_checkout", "flagged"]))
        .order_by(AttendanceSession.work_date.desc(), AttendanceSession.check_in.desc())
        .limit(100)
    ).all()

    return [attendance_session_dict(s) for s in flagged_sessions]


@router.post("/resolve-flag/{session_id}")
def resolve_flag(
    session_id: int,
    payload: ResolveFlagPayload,
    user: User = Depends(require_permission("attendance", "approve")),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can resolve attendance flags.")

    session = db.get(AttendanceSession, session_id)
    require_found(session, "Attendance session")

    prev_state = {
        "status": session.status,
        "check_out": session.check_out.isoformat() if session.check_out else None,
    }

    session.check_out = to_utc_naive(payload.check_out)
    session.check_out_reason = payload.check_out_reason
    session.check_out_note = payload.check_out_note
    session.status = "completed"
    session.is_manual = True
    session.correction_reason = f"Flag resolved: {payload.resolution_reason}"
    session.corrected_by_id = user.id

    _recalculate_daily_metrics(db, session.user_id, session.work_date)

    log_audit(
        db,
        actor_id=user.id,
        action="attendance.flag_resolved",
        category="attendance",
        description=f"Resolved flagged session #{session.session_number} for user #{session.user_id} with checkout {to_ist(session.check_out).strftime('%I:%M %p')}. Reason: {payload.resolution_reason}",
        entity_type="attendance_session",
        entity_id=session.id,
        previous_state=prev_state,
        new_state={
            "check_out": format_iso_ist(session.check_out),
            "reason": payload.check_out_reason,
            "correction_reason": payload.resolution_reason,
        },
    )

    db.commit()
    db.refresh(session)
    return attendance_session_dict(session)


# =========================================================================
# ADMIN MANUAL CORRECTION & CREATION
# =========================================================================

@router.post("/sessions", status_code=201)
def admin_create_session(
    payload: SessionManualCreate,
    user: User = Depends(require_permission("attendance", "create")),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can add authorized attendance sessions.")

    staff = db.get(User, payload.user_id)
    require_found(staff, "Staff member")

    session_count = (
        db.scalar(
            select(func.count(AttendanceSession.id)).where(
                AttendanceSession.user_id == payload.user_id,
                AttendanceSession.work_date == payload.work_date,
            )
        )
        or 0
    )

    check_in_utc = to_utc_naive(payload.check_in)
    check_out_utc = to_utc_naive(payload.check_out) if payload.check_out else None

    new_session = AttendanceSession(
        user_id=payload.user_id,
        work_date=payload.work_date,
        session_number=session_count + 1,
        check_in=check_in_utc,
        check_out=check_out_utc,
        check_out_reason=payload.check_out_reason or "Official Work Outside Office",
        check_out_note=payload.check_out_note,
        check_in_note=payload.check_in_note,
        status="completed" if check_out_utc else "active",
        is_manual=True,
        correction_reason=payload.correction_reason,
        corrected_by_id=user.id,
    )
    db.add(new_session)
    db.flush()

    _recalculate_daily_metrics(db, payload.user_id, payload.work_date)

    log_audit(
        db,
        actor_id=user.id,
        action="attendance.manual_session_created",
        category="attendance",
        description=f"Admin added authorized attendance session for {staff.name} on {payload.work_date}. Reason: {payload.correction_reason}",
        entity_type="attendance_session",
        entity_id=new_session.id,
        new_state={
            "user_id": payload.user_id,
            "work_date": payload.work_date.isoformat(),
            "check_in": format_iso_ist(check_in_utc),
            "check_out": format_iso_ist(check_out_utc) if check_out_utc else None,
            "reason": payload.correction_reason,
        },
    )

    db.commit()
    db.refresh(new_session)
    return attendance_session_dict(new_session)


@router.patch("/sessions/{session_id}")
def admin_edit_session(
    session_id: int,
    payload: SessionManualEdit,
    user: User = Depends(require_permission("attendance", "edit")),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can correct attendance sessions.")

    session = db.get(AttendanceSession, session_id)
    require_found(session, "Attendance session")

    prev_state = {
        "check_in": session.check_in.isoformat() if session.check_in else None,
        "check_out": session.check_out.isoformat() if session.check_out else None,
        "reason": session.check_out_reason,
        "status": session.status,
    }

    if payload.check_in is not None:
        session.check_in = to_utc_naive(payload.check_in)
    if payload.check_out is not None:
        session.check_out = to_utc_naive(payload.check_out)
    if payload.check_out_reason is not None:
        session.check_out_reason = payload.check_out_reason
    if payload.check_out_note is not None:
        session.check_out_note = payload.check_out_note
    if payload.check_in_note is not None:
        session.check_in_note = payload.check_in_note
    if payload.status is not None:
        session.status = payload.status

    session.is_manual = True
    session.correction_reason = payload.correction_reason
    session.corrected_by_id = user.id

    _recalculate_daily_metrics(db, session.user_id, session.work_date)

    log_audit(
        db,
        actor_id=user.id,
        action="attendance.session_corrected",
        category="attendance",
        description=f"Admin corrected Session #{session.session_number} on {session.work_date}. Reason: {payload.correction_reason}",
        entity_type="attendance_session",
        entity_id=session.id,
        previous_state=prev_state,
        new_state={
            "check_in": session.check_in.isoformat() if session.check_in else None,
            "check_out": session.check_out.isoformat() if session.check_out else None,
            "reason": payload.correction_reason,
        },
    )

    db.commit()
    db.refresh(session)
    return attendance_session_dict(session)


@router.delete("/sessions/{session_id}")
def admin_delete_session(
    session_id: int,
    reason: str = Query(..., min_length=3, max_length=500),
    user: User = Depends(require_permission("attendance", "delete")),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can delete attendance sessions.")

    session = db.get(AttendanceSession, session_id)
    require_found(session, "Attendance session")

    user_id = session.user_id
    work_date = session.work_date
    session_num = session.session_number

    log_audit(
        db,
        actor_id=user.id,
        action="attendance.session_deleted",
        category="attendance",
        description=f"Admin deleted Session #{session_num} on {work_date}. Reason: {reason}",
        entity_type="attendance_session",
        entity_id=session_id,
        previous_state={
            "user_id": user_id,
            "work_date": work_date.isoformat(),
            "check_in": session.check_in.isoformat() if session.check_in else None,
            "check_out": session.check_out.isoformat() if session.check_out else None,
            "reason": reason,
        },
    )

    db.delete(session)
    db.flush()

    _recalculate_daily_metrics(db, user_id, work_date)
    db.commit()

    return {"message": f"Session #{session_num} deleted and daily totals updated."}


# =========================================================================
# CSV EXPORT FOR REPORTS
# =========================================================================

@router.get("/export")
def export_attendance_report(
    date_from: str | None = None,
    date_to: str | None = None,
    staff_id: int | None = None,
    user: User = Depends(require_permission("attendance", "export")),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Attendance)
        .options(selectinload(Attendance.user))
        .join(User, Attendance.user_id == User.id)
    )
    if user.role != "admin":
        stmt = stmt.where(Attendance.user_id == user.id)
    elif staff_id:
        stmt = stmt.where(Attendance.user_id == staff_id)

    start = parse_date(date_from)
    end = parse_date(date_to)
    if start:
        stmt = stmt.where(Attendance.work_date >= start)
    if end:
        stmt = stmt.where(Attendance.work_date <= end)
    stmt = stmt.order_by(Attendance.work_date.desc(), User.name.asc())

    records = db.scalars(stmt).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Employee ID",
        "Employee Name",
        "Department",
        "First Check-In",
        "Latest Check-Out",
        "Total Active Working Time",
        "Working Hours (Decimal)",
        "Total Break Duration",
        "Number of Exits",
        "Attendance Status",
        "Flagged Review",
        "Notes",
    ])

    for r in records:
        writer.writerow([
            r.work_date.isoformat(),
            r.user.staff_code or "",
            r.user.name or "",
            getattr(r.user, "department", "") or "",
            to_ist(r.check_in).strftime("%I:%M %p") if r.check_in else "Not Recorded",
            to_ist(r.check_out).strftime("%I:%M %p") if r.check_out else "Not Recorded",
            _format_duration(r.total_working_seconds),
            f"{round(r.total_working_seconds / 3600, 2)}" if r.total_working_seconds else "0.00",
            _format_duration(r.total_break_seconds),
            r.exit_count,
            r.status.replace("_", " ").title(),
            "YES" if r.is_flagged else "NO",
            r.note or r.flag_reason or "",
        ])

    csv_data = output.getvalue()
    filename = f"STACKZYRO_Attendance_Report_{now_ist().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

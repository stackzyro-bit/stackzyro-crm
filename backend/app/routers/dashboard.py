from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import (
    Activity,
    Attendance,
    AttendanceSession,
    AuditLog,
    Call,
    Client,
    FollowUp,
    Lead,
    Meeting,
    Proposal,
    User,
)
from ..serialize import (
    activity_dict,
    attendance_dict,
    audit_log_dict,
    followup_dict,
    meeting_dict,
    user_brief,
)
from ..utils import parse_date

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _count(db: Session, model, *conditions) -> int:
    return int(db.scalar(select(func.count(model.id)).where(*conditions)) or 0)


def _lead_status_counts(db: Session, *conditions) -> dict:
    rows = db.execute(
        select(Lead.status, func.count(Lead.id)).where(*conditions).group_by(Lead.status)
    ).all()
    counts = {key: 0 for key in ["new", "interested", "not_interested", "accepted", "proposal_required", "converted"]}
    for status, total in rows:
        counts[status] = int(total)
    return counts


def _call_activity(db: Session, scope_conditions: list, base_date: date | None = None) -> dict:
    ref_date = base_date or datetime.now().date()
    daily = []
    for offset in range(6, -1, -1):
        day = ref_date - timedelta(days=offset)
        start = datetime.combine(day, datetime.min.time())
        end = start + timedelta(days=1)
        base = [Call.called_at >= start, Call.called_at < end, *scope_conditions]
        total = _count(db, Call, *base)
        not_taken = _count(db, Call, *base, Call.outcome == "not_taken")
        daily.append(
            {
                "label": day.strftime("%a"),
                "date": day.isoformat(),
                "total": total,
                "answered": max(total - not_taken, 0),
                "not_taken": not_taken,
            }
        )
    return {"daily": daily}


def _today_followups(db: Session, conditions: list, limit: int = 8) -> list[dict]:
    today = datetime.now().date()
    start = datetime.combine(today, datetime.min.time())
    end = start + timedelta(days=1)
    rows = db.scalars(
        select(FollowUp)
        .options(
            selectinload(FollowUp.lead),
            selectinload(FollowUp.staff),
        )
        .where(*conditions, FollowUp.status == "pending", FollowUp.due_at >= start, FollowUp.due_at < end)
        .order_by(FollowUp.due_at)
        .limit(limit)
    ).all()
    return [followup_dict(row) for row in rows]


def _recent_activities(db: Session, conditions: list, limit: int = 8) -> list[dict]:
    rows = db.scalars(
        select(Activity)
        .options(selectinload(Activity.actor))
        .where(*conditions)
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(limit)
    ).all()
    return [activity_dict(row) for row in rows]


@router.get("")
def dashboard(
    staff_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    now = datetime.now()
    start_today = datetime.combine(today, datetime.min.time())
    end_today = start_today + timedelta(days=1)
    last_30 = now - timedelta(days=30)

    # Date range filters
    df = parse_date(date_from)
    dt = parse_date(date_to)
    dt_end = datetime.combine(dt + timedelta(days=1), datetime.min.time()) if dt else None
    df_start = datetime.combine(df, datetime.min.time()) if df else None

    if user.role == "admin":
        lead_filter = []
        call_filter = []
        proposal_filter = []
        meeting_filter = []

        if staff_id:
            lead_filter.append(Lead.assigned_staff_id == staff_id)
            call_filter.append(Call.staff_id == staff_id)
            proposal_filter.append(Proposal.created_by_id == staff_id)
            meeting_filter.append(Meeting.staff_id == staff_id)

        if df_start:
            lead_filter.append(Lead.created_at >= df_start)
            call_filter.append(Call.called_at >= df_start)
            proposal_filter.append(Proposal.created_at >= df_start)
            meeting_filter.append(Meeting.scheduled_at >= df_start)
        if dt_end:
            lead_filter.append(Lead.created_at < dt_end)
            call_filter.append(Call.called_at < dt_end)
            proposal_filter.append(Proposal.created_at < dt_end)
            meeting_filter.append(Meeting.scheduled_at < dt_end)

        total_leads = _count(db, Lead, *lead_filter)
        status_counts = _lead_status_counts(db, *lead_filter)
        total_calls = _count(db, Call, *call_filter)
        not_taken = _count(db, Call, *call_filter, Call.outcome == "not_taken")
        proposals_sent = _count(db, Proposal, *proposal_filter, Proposal.sent_at.is_not(None))
        accepted_proposals = _count(db, Proposal, *proposal_filter, Proposal.status == "accepted")
        converted_clients = _count(db, Client)
        pending_followups = _count(db, FollowUp, FollowUp.status == "pending")
        scheduled_meetings = _count(db, Meeting, *meeting_filter, Meeting.status == "scheduled")

        staff_members = db.scalars(
            select(User).where(User.role == "staff", User.is_active.is_(True)).order_by(User.name)
        ).all()

        metrics = {
            "total_leads": {
                "value": total_leads,
                "last_30_days": _count(db, Lead, Lead.created_at >= last_30, *lead_filter),
            },
            "new_leads": {
                "value": status_counts.get("new", 0),
                "previous": None,
            },
            "total_calls": {
                "value": total_calls,
                "last_30_days": _count(db, Call, Call.called_at >= last_30, *call_filter),
            },
            "not_taken": {"value": not_taken, "previous": None},
            "interested": {"value": status_counts["interested"], "previous": None},
            "not_interested": {"value": status_counts["not_interested"], "previous": None},
            "accepted": {"value": status_counts["accepted"], "previous": None},
            "proposals_required": {"value": status_counts["proposal_required"], "previous": None},
            "proposals_sent": {"value": proposals_sent, "previous": None},
            "accepted_proposals": {"value": accepted_proposals, "previous": None},
            "followups_pending": {"value": pending_followups, "previous": None},
            "meetings_scheduled": {"value": scheduled_meetings, "previous": None},
            "converted_clients": {"value": converted_clients, "previous": None},
            "total_staff": {"value": len(staff_members), "previous": None},
        }

        upcoming = db.scalars(
            select(FollowUp)
            .options(selectinload(FollowUp.lead), selectinload(FollowUp.staff))
            .where(FollowUp.status == "pending", FollowUp.due_at >= start_today)
            .order_by(FollowUp.due_at)
            .limit(5)
        ).all()

        attendance_rows = db.scalars(
            select(Attendance)
            .options(selectinload(Attendance.user))
            .where(Attendance.work_date == today)
        ).all()
        attendance_by_user = {row.user_id: row for row in attendance_rows}
        staff_attendance = []
        for member in staff_members:
            record = attendance_by_user.get(member.id)
            item = {
                "staff": user_brief(member),
                "status": record.status if record else "absent",
                "check_in": record.check_in.isoformat() if record and record.check_in else None,
                "check_out": record.check_out.isoformat() if record and record.check_out else None,
            }
            staff_attendance.append(item)

        # Staff-wise performance breakdown
        lead_staff_counts = dict(
            db.execute(select(Lead.assigned_staff_id, func.count(Lead.id)).group_by(Lead.assigned_staff_id)).all()
        )
        call_staff_counts = dict(
            db.execute(select(Call.staff_id, func.count(Call.id)).group_by(Call.staff_id)).all()
        )
        staff_performance = []
        for member in staff_members:
            leads_cnt = int(lead_staff_counts.get(member.id, 0))
            calls_cnt = int(call_staff_counts.get(member.id, 0))
            staff_performance.append({
                "staff": user_brief(member),
                "assigned_leads": leads_cnt,
                "calls_logged": calls_cnt,
                "attendance_today": (attendance_by_user.get(member.id).status if attendance_by_user.get(member.id) else "absent"),
            })

        # Recent logins from audit logs
        recent_logins_query = (
            select(AuditLog)
            .options(selectinload(AuditLog.actor))
            .where(AuditLog.category == "auth")
            .order_by(AuditLog.created_at.desc())
            .limit(6)
        )
        recent_logins = [audit_log_dict(row) for row in db.scalars(recent_logins_query).all()]

        return {
            "role": "admin",
            "metrics": metrics,
            "call_activity": _call_activity(db, call_filter),
            "lead_status_overview": {
                "new": status_counts["new"],
                "interested": status_counts["interested"],
                "not_interested": status_counts["not_interested"],
                "accepted": status_counts["accepted"],
                "proposal_required": status_counts["proposal_required"],
                "converted": status_counts["converted"],
            },
            "today_followups": _today_followups(db, []),
            "upcoming_followups": [followup_dict(row) for row in upcoming],
            "staff_attendance": staff_attendance,
            "staff_performance": staff_performance,
            "attendance_summary": {
                "present": sum(1 for row in staff_attendance if row["status"] in {"present", "half_day"}),
                "absent": sum(1 for row in staff_attendance if row["status"] == "absent"),
                "leave": sum(1 for row in staff_attendance if row["status"] == "leave"),
                "total_staff": len(staff_members),
            },
            "recent_activities": _recent_activities(db, []),
            "recent_logins": recent_logins,
            "today_calls": _count(db, Call, Call.called_at >= start_today, Call.called_at < end_today),
            "generated_at": now.isoformat(),
        }

    # Staff view: strictly scoped
    my_leads = Lead.assigned_staff_id == user.id
    status_counts = _lead_status_counts(db, my_leads)
    my_calls_today = _count(
        db, Call, Call.staff_id == user.id, Call.called_at >= start_today, Call.called_at < end_today
    )
    my_calls = Call.staff_id == user.id
    attendance = db.scalar(
        select(Attendance).where(Attendance.user_id == user.id, Attendance.work_date == today)
    )
    my_sessions = db.scalars(
        select(AttendanceSession)
        .where(AttendanceSession.user_id == user.id, AttendanceSession.work_date == today)
        .order_by(AttendanceSession.session_number.asc())
    ).all()
    pending_followups = _count(
        db, FollowUp, FollowUp.staff_id == user.id, FollowUp.status == "pending"
    )

    meetings = db.scalars(
        select(Meeting)
        .options(selectinload(Meeting.lead), selectinload(Meeting.staff))
        .where(
            Meeting.staff_id == user.id,
            Meeting.scheduled_at >= now,
            Meeting.status.in_(["scheduled", "rescheduled"]),
        )
        .order_by(Meeting.scheduled_at)
        .limit(5)
    ).all()

    # Proposals (if staff has proposal permission)
    proposals_count = 0
    if user.has_permission("proposals", "view"):
        proposals_count = _count(db, Proposal, Proposal.created_by_id == user.id)

    metrics = {
        "my_leads": {"value": _count(db, Lead, my_leads), "previous": None},
        "my_calls_today": {"value": my_calls_today, "previous": None},
        "not_taken": {
            "value": _count(db, Call, my_calls, Call.called_at >= start_today, Call.outcome == "not_taken"),
            "previous": None,
        },
        "interested": {"value": status_counts["interested"], "previous": None},
        "not_interested": {"value": status_counts["not_interested"], "previous": None},
        "accepted": {"value": status_counts["accepted"], "previous": None},
        "my_followups": {"value": pending_followups, "previous": None},
        "my_proposals": {"value": proposals_count, "previous": None},
    }

    return {
        "role": "staff",
        "metrics": metrics,
        "attendance_today": attendance_dict(attendance, my_sessions) if attendance else None,
        "today_followups": _today_followups(db, [FollowUp.staff_id == user.id]),
        "upcoming_meetings": [meeting_dict(row) for row in meetings],
        "recent_activities": _recent_activities(db, [Activity.actor_id == user.id]),
        "call_activity": _call_activity(db, [Call.staff_id == user.id]),
        "lead_status_overview": {
            "new": status_counts["new"],
            "interested": status_counts["interested"],
            "not_interested": status_counts["not_interested"],
            "accepted": status_counts["accepted"],
            "proposal_required": status_counts["proposal_required"],
            "converted": status_counts["converted"],
        },
        "generated_at": now.isoformat(),
    }

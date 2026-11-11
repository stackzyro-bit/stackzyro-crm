from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin, require_permission
from ..models import Attendance, Call, FollowUp, Lead, Proposal, User
from ..timezone import ist_day_bounds_utc, today_ist
from ..utils import csv_escape, parse_date

router = APIRouter(prefix="/api/reports", tags=["reports"])

PRESET_LABELS = {
    "today": "Today",
    "yesterday": "Yesterday",
    "week": "This Week",
    "month": "This Month",
    "custom": "Custom Range",
}


def _resolve_range(preset: str, date_from: str | None, date_to: str | None):
    today = today_ist()
    if preset == "yesterday":
        start = end = today - timedelta(days=1)
    elif preset == "week":
        start, end = today - timedelta(days=today.weekday()), today
    elif preset == "month":
        start, end = today.replace(day=1), today
    elif preset == "custom":
        start = parse_date(date_from) or today.replace(day=1)
        end = parse_date(date_to) or today
    else:
        preset = "today"
        start = end = today
    if end < start:
        raise HTTPException(status_code=422, detail="The end date cannot be before the start date.")
    return start, end, PRESET_LABELS.get(preset, "Today")


def _build_report(db: Session, start: date, end: date) -> dict:
    start_dt, _ = ist_day_bounds_utc(start)
    _, end_dt = ist_day_bounds_utc(end)
    lead_window = (Lead.created_at >= start_dt, Lead.created_at <= end_dt)
    call_window = (Call.called_at >= start_dt, Call.called_at <= end_dt)

    lead_status_rows = db.execute(
        select(Lead.status, func.count(Lead.id)).where(*lead_window).group_by(Lead.status)
    ).all()
    lead_status = {status: int(total) for status, total in lead_status_rows}
    total_leads = sum(lead_status.values())

    call_rows = db.execute(
        select(Call.outcome, func.count(Call.id)).where(*call_window).group_by(Call.outcome)
    ).all()
    call_outcomes = {outcome: int(total) for outcome, total in call_rows}
    total_calls = sum(call_outcomes.values())

    proposal_rows = db.execute(
        select(Proposal.status, func.count(Proposal.id))
        .where(Proposal.created_at >= start_dt, Proposal.created_at <= end_dt)
        .group_by(Proposal.status)
    ).all()
    proposal_status = {status: int(total) for status, total in proposal_rows}

    source_rows = db.execute(
        select(Lead.source, func.count(Lead.id)).where(*lead_window).group_by(Lead.source)
    ).all()
    sources = [
        {"source": source or "unknown", "count": int(total)} for source, total in source_rows
    ]
    sources.sort(key=lambda item: item["count"], reverse=True)

    staff_members = db.scalars(
        select(User).where(User.role == "staff").order_by(User.name)
    ).all()

    lead_map = dict(
        db.execute(
            select(Lead.assigned_staff_id, func.count(Lead.id))
            .where(*lead_window)
            .group_by(Lead.assigned_staff_id)
        ).all()
    )
    call_map = dict(
        db.execute(
            select(Call.staff_id, func.count(Call.id)).where(*call_window).group_by(Call.staff_id)
        ).all()
    )
    outcome_map: dict[int, dict[str, int]] = {}
    for staff_id, outcome, total in db.execute(
        select(Call.staff_id, Call.outcome, func.count(Call.id))
        .where(*call_window)
        .group_by(Call.staff_id, Call.outcome)
    ).all():
        outcome_map.setdefault(staff_id, {})[outcome] = int(total)

    follow_map: dict[int, dict[str, int]] = {}
    for staff_id, status, total in db.execute(
        select(FollowUp.staff_id, FollowUp.status, func.count(FollowUp.id))
        .where(FollowUp.due_at >= start_dt, FollowUp.due_at <= end_dt)
        .group_by(FollowUp.staff_id, FollowUp.status)
    ).all():
        follow_map.setdefault(staff_id, {})[status] = int(total)

    attendance_map = dict(
        db.execute(
            select(Attendance.user_id, func.count(Attendance.id))
            .where(
                Attendance.work_date >= start,
                Attendance.work_date <= end,
                Attendance.status.in_(["present", "half_day"]),
            )
            .group_by(Attendance.user_id)
        ).all()
    )

    staff_rows = []
    for member in staff_members:
        outcomes = outcome_map.get(member.id, {})
        follow = follow_map.get(member.id, {})
        follow_total = sum(follow.values())
        staff_rows.append(
            {
                "staff_id": member.id,
                "name": member.name,
                "designation": member.designation,
                "is_active": member.is_active,
                "leads": int(lead_map.get(member.id, 0)),
                "calls": int(call_map.get(member.id, 0)),
                "interested": outcomes.get("interested", 0),
                "not_interested": outcomes.get("not_interested", 0),
                "not_taken": outcomes.get("not_taken", 0),
                "accepted": outcomes.get("accepted", 0),
                "followups_total": follow_total,
                "followups_completed": follow.get("completed", 0),
                "followup_rate": round(follow.get("completed", 0) / follow_total * 100, 1)
                if follow_total
                else 0,
                "present_days": int(attendance_map.get(member.id, 0)),
            }
        )
    staff_rows.sort(key=lambda row: (row["calls"], row["leads"]), reverse=True)

    attendance_rows = db.execute(
        select(Attendance.status, func.count(Attendance.id))
        .where(Attendance.work_date >= start, Attendance.work_date <= end)
        .group_by(Attendance.status)
    ).all()
    attendance_summary = {status: int(total) for status, total in attendance_rows}

    followup_rows = db.execute(
        select(FollowUp.status, func.count(FollowUp.id))
        .where(FollowUp.due_at >= start_dt, FollowUp.due_at <= end_dt)
        .group_by(FollowUp.status)
    ).all()
    followup_status = {status: int(total) for status, total in followup_rows}
    followup_total = sum(followup_status.values())

    leads_payload = {
        "total": total_leads,
        "new": lead_status.get("new", 0),
        "interested": lead_status.get("interested", 0),
        "not_interested": lead_status.get("not_interested", 0),
        "accepted": lead_status.get("accepted", 0),
        "proposal_required": lead_status.get("proposal_required", 0),
        "converted": lead_status.get("converted", 0),
        "conversion_rate": round(lead_status.get("converted", 0) / total_leads * 100, 1)
        if total_leads
        else 0,
    }
    calls_payload = {
        "total": total_calls,
        "not_taken": call_outcomes.get("not_taken", 0),
        "interested": call_outcomes.get("interested", 0),
        "not_interested": call_outcomes.get("not_interested", 0),
        "accepted": call_outcomes.get("accepted", 0),
        "call_back_requested": call_outcomes.get("call_back_requested", 0),
        "proposal_required": call_outcomes.get("proposal_required", 0),
        "do_not_contact": call_outcomes.get("do_not_contact", 0),
        "answered": total_calls - call_outcomes.get("not_taken", 0),
        "by_outcome": call_outcomes,
    }
    proposals_payload = {
        "required": lead_status.get("proposal_required", 0),
        "total": sum(proposal_status.values()),
        "drafted": proposal_status.get("draft", 0),
        "pending": proposal_status.get("pending_approval", 0),
        "approved": proposal_status.get("approved", 0),
        "sent": proposal_status.get("sent", 0),
        "accepted": proposal_status.get("accepted", 0),
        "rejected": proposal_status.get("rejected", 0),
        "expired": proposal_status.get("expired", 0),
        "by_status": proposal_status,
    }
    attendance_payload = {
        "present": attendance_summary.get("present", 0) + attendance_summary.get("half_day", 0),
        "absent": attendance_summary.get("absent", 0),
        "leave": attendance_summary.get("leave", 0),
        "half_day": attendance_summary.get("half_day", 0),
        "records": sum(attendance_summary.values()),
    }
    followups_payload = {
        "total": followup_total,
        "completed": followup_status.get("completed", 0),
        "pending": followup_status.get("pending", 0),
        "cancelled": followup_status.get("cancelled", 0),
        "completion_rate": round(followup_status.get("completed", 0) / followup_total * 100, 1)
        if followup_total
        else 0,
    }

    return {
        "leads": leads_payload,
        "calls": calls_payload,
        "proposals": proposals_payload,
        "attendance": attendance_payload,
        "followups": followups_payload,
        "staff": staff_rows,
        "sources": sources,
    }


@router.get("")
def get_report(
    preset: str = "today",
    date_from: str | None = None,
    date_to: str | None = None,
    admin: User = Depends(require_permission("reports", "view")),
    db: Session = Depends(get_db),
):
    start, end, label = _resolve_range(preset, date_from, date_to)
    report = _build_report(db, start, end)
    return {
        "preset": preset,
        "label": label,
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "generated_at": datetime.now().isoformat(),
        **report,
    }


@router.get("/export.csv")
def export_report(
    preset: str = "today",
    date_from: str | None = None,
    date_to: str | None = None,
    admin: User = Depends(require_permission("reports", "export")),
    db: Session = Depends(get_db),
):
    start, end, label = _resolve_range(preset, date_from, date_to)
    report = _build_report(db, start, end)
    lines = [
        f"STACKZYRO CRM Report,{csv_escape(label)}",
        f"Period,{start.isoformat()} to {end.isoformat()}",
        f"Generated,{datetime.now().isoformat(sep=' ', timespec='seconds')}",
        "",
        "LEAD REPORT",
        "Metric,Value",
        f"Total Leads,{report['leads']['total']}",
        f"New Leads,{report['leads']['new']}",
        f"Interested,{report['leads']['interested']}",
        f"Not Interested,{report['leads']['not_interested']}",
        f"Accepted,{report['leads']['accepted']}",
        f"Proposal Required,{report['leads']['proposal_required']}",
        f"Converted,{report['leads']['converted']}",
        "",
        "CALL REPORT",
        "Metric,Value",
        f"Total Calls,{report['calls']['total']}",
        f"Answered,{report['calls']['answered']}",
        f"Not Taken,{report['calls']['not_taken']}",
        f"Interested,{report['calls']['interested']}",
        f"Not Interested,{report['calls']['not_interested']}",
        f"Accepted,{report['calls']['accepted']}",
        f"Call Back Requested,{report['calls']['call_back_requested']}",
        "",
        "PROPOSAL REPORT",
        "Metric,Value",
        f"Proposals Required,{report['proposals']['required']}",
        f"Drafted,{report['proposals']['drafted']}",
        f"Pending Approval,{report['proposals']['pending']}",
        f"Sent,{report['proposals']['sent']}",
        f"Accepted,{report['proposals']['accepted']}",
        f"Rejected,{report['proposals']['rejected']}",
        "",
        "STAFF REPORT",
        "Staff,Leads,Calls,Interested,Not Interested,Not Taken,Accepted,Follow-ups,Completed,Present Days",
    ]
    for row in report["staff"]:
        lines.append(
            ",".join(
                csv_escape(value)
                for value in [
                    row["name"],
                    row["leads"],
                    row["calls"],
                    row["interested"],
                    row["not_interested"],
                    row["not_taken"],
                    row["accepted"],
                    row["followups_total"],
                    row["followups_completed"],
                    row["present_days"],
                ]
            )
        )
    lines += [
        "",
        "ATTENDANCE SUMMARY",
        f"Present,{report['attendance']['present']}",
        f"Absent,{report['attendance']['absent']}",
        f"On Leave,{report['attendance']['leave']}",
        f"Total Records,{report['attendance']['records']}",
    ]
    return Response(
        content="\n".join(lines),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="stackzyro-report-{start.isoformat()}-{end.isoformat()}.csv"'
        },
    )

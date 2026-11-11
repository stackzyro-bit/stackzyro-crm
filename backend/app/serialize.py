import json
from datetime import datetime

from .constants import PROPOSAL_TEMPLATES
from .models import (
    Activity,
    Attendance,
    AttendanceSession,
    Call,
    Client,
    Conversation,
    ConversationParticipant,
    FollowUp,
    Lead,
    Meeting,
    Message,
    MessageReceipt,
    Proposal,
    User,
)
from .timezone import format_iso_ist, format_iso_utc, now_utc_naive
from .utils import money


def initials(name: str | None) -> str:
    if not name:
        return "SZ"
    parts = [p for p in name.split() if p]
    return "".join(p[0] for p in parts[:2]).upper() or "SZ"


def user_brief(user: User | None) -> dict | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "staff_code": user.staff_code,
        "username": user.username or (user.email.split("@")[0] if user.email else ""),
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "designation": user.designation,
        "department": getattr(user, "department", None),
        "role": user.role,
        "status": getattr(user, "status", "active"),
        "is_active": user.is_active,
        "must_change_password": bool(getattr(user, "must_change_password", False)),
        "joined_on": user.joined_on.isoformat() if user.joined_on else None,
        "last_login_at": user.last_login_at.isoformat() if getattr(user, "last_login_at", None) else None,
        "last_login_ip": getattr(user, "last_login_ip", None),
        "permissions": user.get_permissions(),
        "initials": initials(user.name),
    }


def audit_log_dict(entry) -> dict:
    import json
    return {
        "id": entry.id,
        "actor_id": entry.actor_id,
        "actor": user_brief(entry.actor) if entry.actor else None,
        "action": entry.action,
        "category": entry.category,
        "description": entry.description,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "entity_ref": entry.entity_ref,
        "previous_state": json.loads(entry.previous_state) if entry.previous_state else None,
        "new_state": json.loads(entry.new_state) if entry.new_state else None,
        "ip_address": entry.ip_address,
        "created_at": format_iso_utc(entry.created_at),
    }


def lead_dict(lead: Lead, detail: bool = False) -> dict:
    data = {
        "id": lead.id,
        "code": lead.code,
        "business_name": lead.business_name,
        "contact_person": lead.contact_person,
        "phone": lead.phone,
        "email": lead.email,
        "location": lead.location,
        "category": lead.category,
        "website": lead.website,
        "social_links": lead.social_links,
        "source": lead.source,
        "requirements": lead.requirements,
        "notes": lead.notes,
        "status": lead.status,
        "assigned_staff_id": lead.assigned_staff_id,
        "assigned_staff": user_brief(lead.assigned_staff),
        "services": [{"id": s.id, "name": s.name} for s in lead.services],
        "next_follow_up": format_iso_utc(lead.next_follow_up),
        "created_by": user_brief(lead.created_by),
        "created_at": format_iso_utc(lead.created_at),
        "updated_at": format_iso_utc(lead.updated_at),
    }
    if detail:
        data["calls"] = [call_dict(c) for c in lead.calls]
        data["follow_ups"] = [followup_dict(f) for f in lead.follow_ups]
        data["meetings"] = [meeting_dict(m) for m in lead.meetings]
        data["proposals"] = [proposal_dict(p, with_content=False) for p in lead.proposals]
        data["client"] = client_dict(lead.client) if lead.client else None
    return data


def call_dict(call: Call) -> dict:
    return {
        "id": call.id,
        "code": call.code,
        "lead_id": call.lead_id,
        "lead_code": call.lead.code if call.lead else None,
        "business_name": call.lead.business_name if call.lead else None,
        "staff_id": call.staff_id,
        "staff": user_brief(call.staff),
        "called_at": format_iso_utc(call.called_at),
        "outcome": call.outcome,
        "notes": call.notes,
        "next_follow_up": format_iso_utc(call.next_follow_up),
        "created_at": format_iso_utc(call.created_at),
    }


def followup_effective_status(followup: FollowUp, now: datetime | None = None) -> str:
    now = now or now_utc_naive()
    if followup.status == "pending" and followup.due_at and followup.due_at < now:
        return "overdue"
    return followup.status


def followup_dict(followup: FollowUp) -> dict:
    return {
        "id": followup.id,
        "code": followup.code,
        "lead_id": followup.lead_id,
        "lead_code": followup.lead.code if followup.lead else None,
        "business_name": followup.lead.business_name if followup.lead else None,
        "contact_person": followup.lead.contact_person if followup.lead else None,
        "phone": followup.lead.phone if followup.lead else None,
        "staff_id": followup.staff_id,
        "staff": user_brief(followup.staff),
        "due_at": format_iso_utc(followup.due_at),
        "method": followup.method,
        "notes": followup.notes,
        "status": followup_effective_status(followup),
        "stored_status": followup.status,
        "completed_at": format_iso_utc(followup.completed_at),
        "created_at": format_iso_utc(followup.created_at),
    }


def proposal_content(proposal: Proposal) -> dict:
    if not proposal.content:
        template = next(
            (t for t in PROPOSAL_TEMPLATES if t["key"] == proposal.template_key), None
        )
        return {
            "overview": "",
            "requirements": [],
            "scope": template["scope"] if template else [],
            "deliverables": template["deliverables"] if template else [],
            "timeline": template["timeline"] if template else [],
            "pricing": [],
            "subtotal": 0,
            "discount": 0,
            "tax_rate": 0,
            "total": money(proposal.amount),
            "payment_terms": template["payment_terms"] if template else "",
            "additional_costs": template["additional_costs"] if template else "",
            "terms": template["terms"] if template else [],
            "valid_until": None,
        }
    try:
        return json.loads(proposal.content)
    except json.JSONDecodeError:
        return {}


def proposal_dict(proposal: Proposal, with_content: bool = True) -> dict:
    data = {
        "id": proposal.id,
        "code": proposal.code,
        "lead_id": proposal.lead_id,
        "lead_code": proposal.lead.code if proposal.lead else None,
        "business_name": proposal.lead.business_name if proposal.lead else None,
        "contact_person": proposal.lead.contact_person if proposal.lead else None,
        "phone": proposal.lead.phone if proposal.lead else (proposal.client.phone if proposal.client else None),
        "email": proposal.lead.email if proposal.lead else (proposal.client.email if proposal.client else None),
        "client_id": proposal.client_id,
        "title": proposal.title,
        "service_type": proposal.service_type,
        "status": proposal.status,
        "amount": money(proposal.amount),
        "template_key": proposal.template_key,
        "created_by": user_brief(proposal.created_by),
        "created_at": proposal.created_at.isoformat(),
        "updated_at": proposal.updated_at.isoformat(),
        "sent_at": proposal.sent_at.isoformat() if proposal.sent_at else None,
        "decided_at": proposal.decided_at.isoformat() if proposal.decided_at else None,
    }
    if with_content:
        data["content"] = proposal_content(proposal)
    return data


def meeting_dict(meeting: Meeting) -> dict:
    return {
        "id": meeting.id,
        "code": meeting.code,
        "lead_id": meeting.lead_id,
        "lead_code": meeting.lead.code if meeting.lead else None,
        "business_name": meeting.lead.business_name if meeting.lead else None,
        "contact_person": meeting.lead.contact_person if meeting.lead else None,
        "phone": meeting.lead.phone if meeting.lead else None,
        "staff_id": meeting.staff_id,
        "staff": user_brief(meeting.staff),
        "scheduled_at": format_iso_utc(meeting.scheduled_at),
        "duration_minutes": meeting.duration_minutes,
        "meeting_type": meeting.meeting_type,
        "location": meeting.location,
        "status": meeting.status,
        "notes": meeting.notes,
        "created_at": format_iso_utc(meeting.created_at),
    }


def client_dict(client: Client) -> dict:
    return {
        "id": client.id,
        "code": client.code,
        "lead_id": client.lead_id,
        "lead_code": client.lead.code if client.lead else None,
        "business_name": client.business_name,
        "contact_person": client.contact_person,
        "phone": client.phone,
        "email": client.email,
        "services": client.services,
        "start_date": client.start_date.isoformat() if client.start_date else None,
        "project_status": client.project_status,
        "assigned_staff_id": client.assigned_staff_id,
        "assigned_staff": user_brief(client.assigned_staff),
        "notes": client.notes,
        "created_at": client.created_at.isoformat(),
    }


def _format_duration(seconds: int | None) -> str:
    if seconds is None or seconds <= 0:
        return "0m"
    hrs = seconds // 3600
    mins = (seconds % 3600) // 60
    if hrs > 0 and mins > 0:
        return f"{hrs}h {mins}m"
    if hrs > 0:
        return f"{hrs}h"
    return f"{mins}m"


def attendance_session_dict(session: AttendanceSession) -> dict:
    working_secs = session.working_seconds
    if working_secs is None and session.check_in and session.check_out:
        working_secs = int((session.check_out - session.check_in).total_seconds())

    return {
        "id": session.id,
        "user_id": session.user_id,
        "work_date": session.work_date.isoformat(),
        "session_number": session.session_number,
        "check_in": format_iso_utc(session.check_in),
        "check_out": format_iso_utc(session.check_out),
        "check_out_reason": session.check_out_reason,
        "check_out_note": session.check_out_note,
        "check_in_note": session.check_in_note,
        "working_seconds": working_secs,
        "working_duration": _format_duration(working_secs) if working_secs is not None else None,
        "break_seconds": session.break_seconds,
        "break_duration": _format_duration(session.break_seconds) if session.break_seconds is not None else None,
        "status": session.status,
        "is_manual": bool(session.is_manual),
        "correction_reason": session.correction_reason,
        "corrected_by": user_brief(session.corrected_by) if getattr(session, "corrected_by", None) else None,
        "created_at": format_iso_utc(session.created_at),
    }


def attendance_dict(record: Attendance, sessions: list[AttendanceSession] | None = None) -> dict:
    total_working = getattr(record, "total_working_seconds", None)
    if total_working is not None and total_working > 0:
        hours = round(total_working / 3600, 2)
    elif record.check_in and record.check_out:
        delta = record.check_out - record.check_in
        hours = round(delta.total_seconds() / 3600, 2)
        total_working = int(delta.total_seconds())
    else:
        hours = None
        total_working = 0

    total_break = getattr(record, "total_break_seconds", 0) or 0
    exit_count = getattr(record, "exit_count", 0) or 0
    is_flagged = bool(getattr(record, "is_flagged", False))
    flag_reason = getattr(record, "flag_reason", None)

    return {
        "id": record.id,
        "user_id": record.user_id,
        "staff": user_brief(record.user),
        "work_date": record.work_date.isoformat(),
        "check_in": format_iso_utc(record.check_in),
        "check_out": format_iso_utc(record.check_out),
        "working_hours": hours,
        "total_working_seconds": total_working,
        "working_duration": _format_duration(total_working),
        "total_break_seconds": total_break,
        "break_duration": _format_duration(total_break),
        "exit_count": exit_count,
        "is_flagged": is_flagged,
        "flag_reason": flag_reason,
        "status": record.status,
        "note": record.note,
        "sessions": [attendance_session_dict(s) for s in sessions] if sessions is not None else None,
    }


def activity_dict(activity: Activity) -> dict:
    return {
        "id": activity.id,
        "type": activity.type,
        "title": activity.title,
        "description": activity.description,
        "entity_type": activity.entity_type,
        "entity_id": activity.entity_id,
        "actor": user_brief(activity.actor),
        "created_at": format_iso_utc(activity.created_at),
    }


def message_dict(msg: Message, current_user_id: int | None = None) -> dict:
    receipts_list = []
    is_read_by_me = False
    for r in getattr(msg, "receipts", []):
        if r.user_id == current_user_id:
            is_read_by_me = r.is_read
        receipts_list.append({
            "user_id": r.user_id,
            "user_name": r.user.name if getattr(r, "user", None) else "",
            "is_delivered": r.is_delivered,
            "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None,
            "is_read": r.is_read,
            "read_at": r.read_at.isoformat() if r.read_at else None,
        })
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender": user_brief(msg.sender) if getattr(msg, "sender", None) else None,
        "content": msg.content,
        "attachment_url": msg.attachment_url,
        "attachment_name": msg.attachment_name,
        "attachment_size": msg.attachment_size,
        "attachment_type": msg.attachment_type,
        "created_at": msg.created_at.isoformat(),
        "is_read_by_me": is_read_by_me if current_user_id != msg.sender_id else True,
        "receipts": receipts_list,
    }


def conversation_dict(
    conv: Conversation, current_user_id: int | None = None, include_messages: bool = False
) -> dict:
    participants_list = []
    my_participant = None
    for p in getattr(conv, "participants", []):
        p_dict = {
            "id": p.id,
            "user_id": p.user_id,
            "user": user_brief(p.user) if getattr(p, "user", None) else None,
            "role": p.role,
            "last_read_at": p.last_read_at.isoformat() if p.last_read_at else None,
            "is_archived": p.is_archived,
        }
        participants_list.append(p_dict)
        if current_user_id and p.user_id == current_user_id:
            my_participant = p

    messages = getattr(conv, "messages", [])
    latest_message = messages[-1] if messages else None

    unread_count = 0
    if current_user_id:
        for m in messages:
            if m.sender_id != current_user_id:
                r = next((rc for rc in getattr(m, "receipts", []) if rc.user_id == current_user_id), None)
                if not r or not r.is_read:
                    unread_count += 1

    data = {
        "id": conv.id,
        "code": conv.code,
        "subject": conv.subject,
        "category": conv.category,
        "priority": conv.priority,
        "is_announcement": conv.is_announcement,
        "is_pinned": conv.is_pinned,
        "target_audience": conv.target_audience,
        "target_role": conv.target_role,
        "created_by_id": conv.created_by_id,
        "created_by": user_brief(conv.created_by) if getattr(conv, "created_by", None) else None,
        "status": conv.status,
        "is_archived": my_participant.is_archived if my_participant else (conv.status == "archived"),
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
        "participants": participants_list,
        "message_count": len(messages),
        "has_unread": unread_count > 0,
        "unread_count": unread_count,
        "latest_message": message_dict(latest_message, current_user_id) if latest_message else None,
        "last_message": {
            "content": latest_message.content,
            "created_at": latest_message.created_at.isoformat(),
            "sender_name": latest_message.sender.name if getattr(latest_message, "sender", None) else "",
        } if latest_message else None,
    }

    if include_messages:
        data["messages"] = [message_dict(m, current_user_id) for m in messages]

    return data

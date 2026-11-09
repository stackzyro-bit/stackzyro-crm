import base64
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..audit import log_audit
from ..database import get_db
from ..deps import get_current_user, require_admin, require_permission
from ..models import Conversation, ConversationParticipant, Message, MessageReceipt, User
from ..schemas import ConversationCreate, ConversationUpdate, MessageReply
from ..serialize import conversation_dict, message_dict, user_brief
from ..utils import next_code, paginate, require_found

router = APIRouter(prefix="/api/messages", tags=["messages"])

CONVERSATION_OPTIONS = (
    selectinload(Conversation.created_by),
    selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
    selectinload(Conversation.messages).selectinload(Message.sender),
    selectinload(Conversation.messages).selectinload(Message.receipts).selectinload(MessageReceipt.user),
)


def _user_can_access_conversation(conv: Conversation, user: User) -> bool:
    if user.role == "admin":
        return True
    if conv.created_by_id == user.id:
        return True
    if conv.is_announcement:
        if conv.target_audience == "all_staff":
            return True
        if conv.target_audience == "role" and conv.target_role == user.role:
            return True
    return any(p.user_id == user.id for p in conv.participants)


@router.get("/recipients")
def list_recipients(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the list of eligible message recipients based on role.
    Admin can message all active staff.
    Staff can only message Admin.
    """
    if user.role == "admin":
        staff_members = db.scalars(
            select(User)
            .where(User.role == "staff", User.is_active.is_(True))
            .order_by(User.name.asc())
        ).all()
        return [user_brief(u) for u in staff_members]
    else:
        admins = db.scalars(
            select(User)
            .where(User.role == "admin", User.is_active.is_(True))
            .order_by(User.name.asc())
        ).all()
        return [user_brief(u) for u in admins]


@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """
    Upload an attachment for a message or announcement.
    Returns the file metadata and data URL.
    """
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 10MB.")

    b64 = base64.b64encode(contents).decode("utf-8")
    content_type = file.content_type or "application/octet-stream"
    data_url = f"data:{content_type};base64,{b64}"

    return {
        "url": data_url,
        "name": file.filename,
        "size": len(contents),
        "type": content_type,
    }


@router.get("/unread-count")
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns live unread message and announcement counts for dashboard badges and sidebar indicator.
    """
    # Find all unread receipts for this user
    unread_receipts = db.scalars(
        select(MessageReceipt)
        .join(Message, MessageReceipt.message_id == Message.id)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            MessageReceipt.user_id == user.id,
            MessageReceipt.is_read.is_(False),
            Conversation.status == "active",
        )
    ).all()

    unread_messages = 0
    unread_announcements = 0
    urgent_count = 0

    seen_convs = set()
    for r in unread_receipts:
        c_id = r.message.conversation_id
        if c_id not in seen_convs:
            seen_convs.add(c_id)
            if r.message.conversation.is_announcement:
                unread_announcements += 1
            else:
                unread_messages += 1

            if r.message.conversation.priority == "urgent":
                urgent_count += 1

    return {
        "total_unread": unread_messages + unread_announcements,
        "unread_total": unread_messages + unread_announcements,
        "unread_messages": unread_messages,
        "unread_announcements": unread_announcements,
        "urgent_count": urgent_count,
        "urgent_unread": urgent_count,
    }


@router.get("/announcements")
def list_announcements(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns active company announcements for the dashboard announcement widget.
    Pinned announcements are ordered first, followed by most recent.
    """
    stmt = (
        select(Conversation)
        .options(*CONVERSATION_OPTIONS)
        .where(Conversation.is_announcement.is_(True), Conversation.status == "active")
    )

    if user.role != "admin":
        stmt = stmt.where(
            or_(
                Conversation.target_audience == "all_staff",
                Conversation.created_by_id == user.id,
                Conversation.participants.any(ConversationParticipant.user_id == user.id),
            )
        )

    stmt = stmt.order_by(
        Conversation.is_pinned.desc(),
        Conversation.updated_at.desc(),
        Conversation.id.desc(),
    ).limit(10)

    rows = db.scalars(stmt).all()
    items = [conversation_dict(row, current_user_id=user.id, include_messages=True) for row in rows]
    return {"items": items}


@router.get("/conversations")
def list_conversations(
    folder: str = "all",  # all, inbox, sent, announcements, urgent, unread, archived
    category: str | None = None,
    priority: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns list of conversations matching folder, search and priority filters.
    """
    stmt = select(Conversation).options(*CONVERSATION_OPTIONS)

    # 1. Role-based visibility
    if user.role != "admin":
        stmt = stmt.where(
            or_(
                Conversation.created_by_id == user.id,
                Conversation.participants.any(ConversationParticipant.user_id == user.id),
                (Conversation.is_announcement.is_(True) & (Conversation.target_audience == "all_staff")),
            )
        )

    # 2. Folder filters
    if folder == "archived":
        if user.role == "admin":
            stmt = stmt.where(Conversation.status == "archived")
        else:
            stmt = stmt.where(
                or_(
                    Conversation.status == "archived",
                    Conversation.participants.any(
                        (ConversationParticipant.user_id == user.id)
                        & (ConversationParticipant.is_archived.is_(True))
                    ),
                )
            )
    else:
        # Default active folders exclude archived
        if user.role == "admin":
            stmt = stmt.where(Conversation.status == "active")
        else:
            stmt = stmt.where(
                Conversation.status == "active",
                ~Conversation.participants.any(
                    (ConversationParticipant.user_id == user.id)
                    & (ConversationParticipant.is_archived.is_(True))
                ),
            )

        if folder == "sent":
            stmt = stmt.where(Conversation.created_by_id == user.id)
        elif folder == "inbox":
            stmt = stmt.where(
                Conversation.created_by_id != user.id,
                Conversation.is_announcement.is_(False),
            )
        elif folder == "announcements":
            stmt = stmt.where(Conversation.is_announcement.is_(True))
        elif folder == "urgent":
            stmt = stmt.where(Conversation.priority == "urgent")
        elif folder == "unread":
            # Filter where there are unread receipts
            stmt = stmt.where(
                Conversation.messages.any(
                    Message.receipts.any(
                        (MessageReceipt.user_id == user.id) & (MessageReceipt.is_read.is_(False))
                    )
                )
            )

    # 3. Category & Priority
    if category and category != "all":
        stmt = stmt.where(Conversation.category == category)
    if priority and priority != "all":
        stmt = stmt.where(Conversation.priority == priority)

    # 4. Search query
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Conversation.subject.ilike(term),
                Conversation.code.ilike(term),
                Conversation.created_by.has(User.name.ilike(term)),
                Conversation.messages.any(Message.content.ilike(term)),
            )
        )

    stmt = stmt.order_by(
        Conversation.is_pinned.desc(),
        Conversation.updated_at.desc(),
        Conversation.id.desc(),
    )

    result = paginate(db, stmt, page, page_size)
    return {
        **result,
        "items": [
            conversation_dict(row, current_user_id=user.id, include_messages=False)
            for row in result["items"]
        ],
    }


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns single conversation with full message thread and automatically marks
    unread messages as read for current user.
    """
    conv = db.scalar(
        select(Conversation)
        .options(*CONVERSATION_OPTIONS)
        .where(Conversation.id == conversation_id)
    )
    require_found(conv, "Conversation")

    if not _user_can_access_conversation(conv, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this conversation.",
        )

    # Mark all unread receipts for current user as read
    now = datetime.now()
    has_read_updates = False
    for msg in conv.messages:
        for r in msg.receipts:
            if r.user_id == user.id and not r.is_read:
                r.is_read = True
                r.read_at = now
                has_read_updates = True

    # Update participant last_read_at
    participant = next((p for p in conv.participants if p.user_id == user.id), None)
    if participant:
        participant.last_read_at = now
        has_read_updates = True

    if has_read_updates:
        db.commit()
        db.refresh(conv)

    return conversation_dict(conv, current_user_id=user.id, include_messages=True)


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    user: User = Depends(require_permission("messages", "create")),
    db: Session = Depends(get_db),
):
    """
    Creates a new message conversation or announcement.
    Admin can broadcast to all staff, selected staff, or individual employees.
    Staff can only send queries or updates to Admin.
    """
    now = datetime.now()

    # 1. Staff security check: staff cannot broadcast or send to other staff
    if user.role != "admin":
        if payload.is_announcement or payload.is_pinned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can publish announcements or pin notices.",
            )
        # Force target to direct Admin
        payload.target_audience = "direct"

        # Find all active admins as recipients
        admin_users = db.scalars(
            select(User).where(User.role == "admin", User.is_active.is_(True))
        ).all()
        if not admin_users:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active administrator account found to receive your message.",
            )
        recipient_ids = [a.id for a in admin_users]
    else:
        # Admin sending
        if payload.target_audience == "all_staff":
            staff_users = db.scalars(
                select(User).where(User.role == "staff", User.is_active.is_(True))
            ).all()
            recipient_ids = [s.id for s in staff_users]
        elif payload.target_audience == "selected_staff":
            if not payload.recipient_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Please select at least one employee recipient.",
                )
            recipient_ids = list(set(payload.recipient_ids))
        else:
            recipient_ids = list(set(payload.recipient_ids))

    # 2. Create conversation
    code = next_code(db, "MSG")
    conv = Conversation(
        code=code,
        subject=payload.subject.strip(),
        category=payload.category,
        priority=payload.priority,
        is_announcement=payload.is_announcement,
        is_pinned=payload.is_pinned if user.role == "admin" else False,
        target_audience=payload.target_audience,
        target_role=payload.target_role,
        created_by_id=user.id,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(conv)
    db.flush()

    # 3. Add creator as participant
    creator_part = ConversationParticipant(
        conversation_id=conv.id,
        user_id=user.id,
        role="creator",
        last_read_at=now,
    )
    db.add(creator_part)

    # 4. Add recipients as participants
    for r_id in recipient_ids:
        if r_id != user.id:
            db.add(
                ConversationParticipant(
                    conversation_id=conv.id,
                    user_id=r_id,
                    role="recipient",
                )
            )
    db.flush()

    # 5. Add initial message
    first_msg = Message(
        conversation_id=conv.id,
        sender_id=user.id,
        content=payload.content.strip(),
        attachment_url=payload.attachment_url,
        attachment_name=payload.attachment_name,
        attachment_size=payload.attachment_size,
        attachment_type=payload.attachment_type,
        created_at=now,
    )
    db.add(first_msg)
    db.flush()

    # 6. Add delivery & read receipts for all recipients
    for r_id in recipient_ids:
        if r_id != user.id:
            db.add(
                MessageReceipt(
                    message_id=first_msg.id,
                    user_id=r_id,
                    is_delivered=True,
                    delivered_at=now,
                    is_read=False,
                )
            )

    # 7. Audit log
    recip_desc = "All Staff" if payload.target_audience == "all_staff" else f"{len(recipient_ids)} recipient(s)"
    log_audit(
        db,
        actor=user,
        action="message.create",
        category="messaging",
        description=f"Created {payload.category} message '{conv.subject}' ({conv.code}) for {recip_desc}",
        entity_type="conversation",
        entity_id=conv.id,
        entity_ref=conv.code,
    )

    db.commit()
    db.refresh(conv)

    # Reload with options
    conv_loaded = db.scalar(
        select(Conversation)
        .options(*CONVERSATION_OPTIONS)
        .where(Conversation.id == conv.id)
    )
    return conversation_dict(conv_loaded, current_user_id=user.id, include_messages=True)


@router.post("/conversations/{conversation_id}/reply")
def reply_conversation(
    conversation_id: int,
    payload: MessageReply,
    user: User = Depends(require_permission("messages", "create")),
    db: Session = Depends(get_db),
):
    """
    Appends a new reply to an existing conversation thread and creates unread receipts.
    """
    conv = db.scalar(
        select(Conversation)
        .options(*CONVERSATION_OPTIONS)
        .where(Conversation.id == conversation_id)
    )
    require_found(conv, "Conversation")

    if not _user_can_access_conversation(conv, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to reply in this conversation.",
        )

    if conv.status == "archived" and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This conversation has been archived by the administrator.",
        )

    now = datetime.now()

    # 1. Ensure user is recorded as participant
    my_part = next((p for p in conv.participants if p.user_id == user.id), None)
    if not my_part:
        my_part = ConversationParticipant(
            conversation_id=conv.id,
            user_id=user.id,
            role="participant",
            last_read_at=now,
        )
        db.add(my_part)
    else:
        my_part.last_read_at = now
        my_part.is_archived = False

    # 2. Create message
    reply_msg = Message(
        conversation_id=conv.id,
        sender_id=user.id,
        content=payload.content.strip(),
        attachment_url=payload.attachment_url,
        attachment_name=payload.attachment_name,
        attachment_size=payload.attachment_size,
        attachment_type=payload.attachment_type,
        created_at=now,
    )
    db.add(reply_msg)
    db.flush()

    # 3. Create delivery receipts for other participants
    # Also if staff replies, ensure admins are added if not present
    participant_user_ids = {p.user_id for p in conv.participants if p.user_id != user.id}
    if user.role != "admin":
        admin_users = db.scalars(select(User).where(User.role == "admin", User.is_active.is_(True))).all()
        for a in admin_users:
            if a.id != user.id:
                participant_user_ids.add(a.id)

    for p_uid in participant_user_ids:
        db.add(
            MessageReceipt(
                message_id=reply_msg.id,
                user_id=p_uid,
                is_delivered=True,
                delivered_at=now,
                is_read=False,
            )
        )

    # 4. Update conversation timestamp and reopen if needed
    conv.updated_at = now
    if conv.status == "archived" and user.role == "admin":
        conv.status = "active"

    db.commit()
    db.refresh(conv)

    conv_loaded = db.scalar(
        select(Conversation)
        .options(*CONVERSATION_OPTIONS)
        .where(Conversation.id == conv.id)
    )
    return conversation_dict(conv_loaded, current_user_id=user.id, include_messages=True)


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: int,
    payload: ConversationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates conversation flags:
    - Admin can pin/unpin or archive globally.
    - Staff can archive in their personal view.
    """
    conv = db.scalar(
        select(Conversation)
        .options(*CONVERSATION_OPTIONS)
        .where(Conversation.id == conversation_id)
    )
    require_found(conv, "Conversation")

    if not _user_can_access_conversation(conv, user):
        raise HTTPException(status_code=403, detail="Access denied.")

    # Pin / Unpin: Admin only
    if payload.is_pinned is not None:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Only administrators can pin announcements.")
        conv.is_pinned = payload.is_pinned

    # Status: Admin only
    if payload.status is not None:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Only administrators can change status globally.")
        conv.status = payload.status

    # User archive toggle
    if payload.is_archived is not None:
        if user.role == "admin":
            conv.status = "archived" if payload.is_archived else "active"
        my_part = next((p for p in conv.participants if p.user_id == user.id), None)
        if my_part:
            my_part.is_archived = payload.is_archived

    db.commit()
    db.refresh(conv)
    return conversation_dict(conv, current_user_id=user.id, include_messages=True)


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Permanently deletes a conversation and all its messages. Admin only.
    """
    conv = db.get(Conversation, conversation_id)
    require_found(conv, "Conversation")

    log_audit(
        db,
        actor=user,
        action="message.delete",
        category="messaging",
        description=f"Deleted conversation '{conv.subject}' ({conv.code})",
        entity_type="conversation",
        entity_id=conv.id,
        entity_ref=conv.code,
    )

    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted."}

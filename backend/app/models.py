from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


lead_services = Table(
    "lead_services",
    Base.metadata,
    Column("lead_id", ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True),
    Column("service_id", ForeignKey("services.id", ondelete="CASCADE"), primary_key=True),
)


class Counter(Base):
    __tablename__ = "counters"

    name: Mapped[str] = mapped_column(String(24), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0)


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(190), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32))
    designation: Mapped[str | None] = mapped_column(String(120))
    department: Mapped[str | None] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(16), default="staff", index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    permissions: Mapped[str | None] = mapped_column(Text, nullable=True)
    joined_on: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    assigned_leads: Mapped[list[Lead]] = relationship(
        back_populates="assigned_staff", foreign_keys="Lead.assigned_staff_id"
    )

    def get_permissions(self) -> dict[str, list[str]]:
        import json
        from .constants import DEFAULT_ADMIN_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS

        if self.role == "admin":
            return DEFAULT_ADMIN_PERMISSIONS
        if not self.permissions:
            return DEFAULT_STAFF_PERMISSIONS
        try:
            return json.loads(self.permissions)
        except Exception:
            return DEFAULT_STAFF_PERMISSIONS

    def has_permission(self, module: str, action: str = "view") -> bool:
        if self.role == "admin":
            return True
        if not self.is_active or self.status != "active":
            return False
        perms = self.get_permissions()
        if module in ("dashboard", "messages") and module not in perms:
            return True
        actions = perms.get(module, [])
        return "*" in actions or action in actions


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    business_name: Mapped[str] = mapped_column(String(180), index=True)
    contact_person: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(190))
    location: Mapped[str | None] = mapped_column(String(180))
    category: Mapped[str | None] = mapped_column(String(120))
    website: Mapped[str | None] = mapped_column(String(240))
    social_links: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(40))
    requirements: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    assigned_staff_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    next_follow_up: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )

    assigned_staff: Mapped[User | None] = relationship(
        back_populates="assigned_leads", foreign_keys=[assigned_staff_id]
    )
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
    services: Mapped[list[Service]] = relationship(secondary=lead_services, lazy="selectin")
    calls: Mapped[list[Call]] = relationship(
        back_populates="lead", cascade="all, delete-orphan", order_by="Call.called_at.desc()"
    )
    follow_ups: Mapped[list[FollowUp]] = relationship(
        back_populates="lead", cascade="all, delete-orphan", order_by="FollowUp.due_at"
    )
    proposals: Mapped[list[Proposal]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )
    meetings: Mapped[list[Meeting]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )
    client: Mapped[Client | None] = relationship(back_populates="lead", uselist=False)


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    called_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    outcome: Mapped[str] = mapped_column(String(30), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    next_follow_up: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    lead: Mapped[Lead] = relationship(back_populates="calls")
    staff: Mapped[User | None] = relationship()


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    method: Mapped[str] = mapped_column(String(20), default="call")
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    lead: Mapped[Lead] = relationship(back_populates="follow_ups")
    staff: Mapped[User | None] = relationship()


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200))
    service_type: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    template_key: Mapped[str | None] = mapped_column(String(80))
    content: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime)

    lead: Mapped[Lead] = relationship(back_populates="proposals")
    client: Mapped[Client | None] = relationship()
    created_by: Mapped[User | None] = relationship()


class ProposalTemplateModel(Base):
    __tablename__ = "proposal_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    service: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(200))
    overview: Mapped[str] = mapped_column(Text)
    scope: Mapped[str | None] = mapped_column(Text)
    deliverables: Mapped[str | None] = mapped_column(Text)
    timeline: Mapped[str | None] = mapped_column(Text)
    tech_stack: Mapped[str | None] = mapped_column(Text)
    pricing: Mapped[str | None] = mapped_column(Text)
    payment_terms: Mapped[str | None] = mapped_column(Text)
    additional_costs: Mapped[str | None] = mapped_column(Text)
    terms: Mapped[str | None] = mapped_column(Text)
    support_terms: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    meeting_type: Mapped[str] = mapped_column(String(20), default="google_meet")
    location: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default="scheduled", index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    lead: Mapped[Lead] = relationship(back_populates="meetings")
    staff: Mapped[User | None] = relationship()


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"), unique=True
    )
    business_name: Mapped[str] = mapped_column(String(180), index=True)
    contact_person: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(190))
    services: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date, index=True)
    project_status: Mapped[str] = mapped_column(String(30), default="in_progress", index=True)
    assigned_staff_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    lead: Mapped[Lead | None] = relationship(back_populates="client")
    assigned_staff: Mapped[User | None] = relationship()


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("user_id", "work_date", name="uq_attendance_user_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    work_date: Mapped[date] = mapped_column(Date, index=True)
    check_in: Mapped[datetime | None] = mapped_column(DateTime)
    check_out: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="present")
    note: Mapped[str | None] = mapped_column(String(255))
    total_working_seconds: Mapped[int] = mapped_column(Integer, default=0)
    total_break_seconds: Mapped[int] = mapped_column(Integer, default=0)
    exit_count: Mapped[int] = mapped_column(Integer, default=0)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped[User] = relationship()


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    work_date: Mapped[date] = mapped_column(Date, index=True)
    session_number: Mapped[int] = mapped_column(Integer, default=1)
    check_in: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    check_out: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    check_out_reason: Mapped[str | None] = mapped_column(String(80), nullable=True)
    check_out_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    check_in_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    working_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    break_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)  # active, completed, flagged, missing_checkout
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    correction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    corrected_by: Mapped[User | None] = relationship(foreign_keys=[corrected_by_id])


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(String(30))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)

    actor: Mapped[User | None] = relationship()


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(60), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    description: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    entity_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    previous_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, index=True
    )

    actor: Mapped[User | None] = relationship()


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    subject: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal", index=True)  # normal, important, urgent
    is_announcement: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    target_audience: Mapped[str] = mapped_column(String(40), default="direct", index=True)  # all_staff, selected_staff, role, direct
    target_role: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)  # active, archived
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, index=True
    )

    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])
    participants: Mapped[list[ConversationParticipant]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conv_participant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="participant")  # creator, recipient, participant
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    conversation: Mapped[Conversation] = relationship(back_populates="participants")
    user: Mapped[User] = relationship()


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    attachment_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attachment_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship()
    receipts: Mapped[list[MessageReceipt]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class MessageReceipt(Base):
    __tablename__ = "message_receipts"
    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_msg_receipt"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    is_delivered: Mapped[bool] = mapped_column(Boolean, default=True)
    delivered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    message: Mapped[Message] = relationship(back_populates="receipts")
    user: Mapped[User] = relationship()

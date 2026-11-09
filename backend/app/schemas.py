from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

LeadStatus = Literal[
    "new", "interested", "not_interested", "accepted", "proposal_required", "converted"
]
CallOutcome = Literal[
    "interested",
    "not_interested",
    "not_taken",
    "call_back_requested",
    "accepted",
    "proposal_required",
    "do_not_contact",
]
FollowUpStatus = Literal["pending", "completed", "cancelled"]
ProposalStatus = Literal[
    "draft", "pending_approval", "approved", "sent", "accepted", "rejected", "expired"
]
ProjectStatus = Literal["in_progress", "on_hold", "completed", "cancelled"]
MeetingStatus = Literal["scheduled", "completed", "rescheduled", "cancelled"]
MeetingType = Literal["google_meet", "on_site", "phone"]
AttendanceStatus = Literal["present", "absent", "leave", "half_day"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    # Support both username or email
    username_or_email: str | None = None
    email: str | None = None
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False

    def get_login_identifier(self) -> str:
        ident = self.username_or_email or self.email or ""
        return ident.strip().lower()


class FirstLoginPassword(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must include at least one letter and one number.")
        return value


class ForgotPasswordRequest(BaseModel):
    username_or_email: str = Field(min_length=2, max_length=190)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must include at least one letter and one number.")
        return value


class LeadBase(BaseModel):
    business_name: str = Field(min_length=2, max_length=180)
    contact_person: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    location: str | None = Field(default=None, max_length=180)
    category: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, max_length=240)
    social_links: str | None = None
    source: str | None = Field(default=None, max_length=40)
    requirements: str | None = None
    notes: str | None = None
    status: LeadStatus = "new"
    assigned_staff_id: int | None = None
    next_follow_up: datetime | None = None
    services: list[int] = Field(default_factory=list)


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=2, max_length=180)
    contact_person: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    location: str | None = None
    category: str | None = None
    website: str | None = None
    social_links: str | None = None
    source: str | None = None
    requirements: str | None = None
    notes: str | None = None
    status: LeadStatus | None = None
    assigned_staff_id: int | None = None
    next_follow_up: datetime | None = None
    services: list[int] | None = None


class CallCreate(BaseModel):
    lead_id: int
    outcome: CallOutcome
    notes: str | None = None
    called_at: datetime | None = None
    next_follow_up: datetime | None = None
    create_follow_up: bool = True


class FollowUpCreate(BaseModel):
    lead_id: int
    due_at: datetime
    method: Literal["call", "whatsapp", "email", "meeting", "visit"] = "call"
    notes: str | None = None
    staff_id: int | None = None


class FollowUpUpdate(BaseModel):
    due_at: datetime | None = None
    method: Literal["call", "whatsapp", "email", "meeting", "visit"] | None = None
    notes: str | None = None
    status: FollowUpStatus | None = None
    staff_id: int | None = None


class ProposalPayload(BaseModel):
    lead_id: int | None = None
    client_id: int | None = None
    title: str = Field(min_length=2, max_length=200)
    service_type: str | None = None
    template_key: str | None = None
    status: ProposalStatus = "draft"
    amount: float = 0
    content: dict | None = None


class ProposalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    service_type: str | None = None
    status: ProposalStatus | None = None
    amount: float | None = None
    content: dict | None = None
    template_key: str | None = None


class ProposalTemplatePayload(BaseModel):
    key: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=160)
    service: str = Field(min_length=2, max_length=160)
    title: str = Field(min_length=2, max_length=200)
    overview: str
    scope: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    timeline: list[dict] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    pricing: list[dict] = Field(default_factory=list)
    payment_terms: str = ""
    additional_costs: str = ""
    terms: list[str] = Field(default_factory=list)
    support_terms: str = ""
    is_default: bool = False


class ProposalTemplateUpdate(BaseModel):
    name: str | None = None
    service: str | None = None
    title: str | None = None
    overview: str | None = None
    scope: list[str] | None = None
    deliverables: list[str] | None = None
    timeline: list[dict] | None = None
    tech_stack: list[str] | None = None
    pricing: list[dict] | None = None
    payment_terms: str | None = None
    additional_costs: str | None = None
    terms: list[str] | None = None
    support_terms: str | None = None
    is_default: bool | None = None


class MeetingCreate(BaseModel):
    lead_id: int
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=10, le=480)
    meeting_type: MeetingType = "google_meet"
    location: str | None = Field(default=None, max_length=300)
    notes: str | None = None
    staff_id: int | None = None
    status: MeetingStatus = "scheduled"


class MeetingUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=480)
    meeting_type: MeetingType | None = None
    location: str | None = None
    notes: str | None = None
    staff_id: int | None = None
    status: MeetingStatus | None = None


class ClientUpdate(BaseModel):
    business_name: str | None = Field(default=None, min_length=2, max_length=180)
    contact_person: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    services: str | None = None
    start_date: date | None = None
    project_status: ProjectStatus | None = None
    assigned_staff_id: int | None = None
    notes: str | None = None


class AttendanceEdit(BaseModel):
    status: AttendanceStatus | None = None
    check_in: datetime | None = None
    check_out: datetime | None = None
    note: str | None = None


class CheckInPayload(BaseModel):
    note: str | None = None


class CheckOutPayload(BaseModel):
    reason: str = Field(min_length=2, max_length=80)
    note: str | None = None


class SessionManualCreate(BaseModel):
    user_id: int
    work_date: date
    check_in: datetime
    check_out: datetime | None = None
    check_out_reason: str | None = None
    check_out_note: str | None = None
    check_in_note: str | None = None
    correction_reason: str = Field(min_length=3, max_length=500)


class SessionManualEdit(BaseModel):
    check_in: datetime | None = None
    check_out: datetime | None = None
    check_out_reason: str | None = None
    check_out_note: str | None = None
    check_in_note: str | None = None
    status: str | None = None
    correction_reason: str = Field(min_length=3, max_length=500)


class ResolveFlagPayload(BaseModel):
    check_out: datetime
    check_out_reason: str = "End of Day"
    check_out_note: str | None = None
    resolution_reason: str = Field(min_length=3, max_length=500)


class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=2, max_length=60)
    email: EmailStr
    phone: str | None = None
    staff_code: str | None = None  # Employee ID
    designation: str | None = None
    department: str | None = None
    role: Literal["admin", "staff"] = "staff"
    status: Literal["active", "inactive", "suspended"] = "active"
    joined_on: date | None = None
    temporary_password: str = Field(min_length=8, max_length=128)
    confirm_temporary_password: str = Field(min_length=8, max_length=128)
    must_change_password: bool = True
    permissions: dict[str, list[str]] | None = None

    @field_validator("temporary_password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Temporary password must include at least one letter and one number.")
        return value


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    username: str | None = Field(default=None, min_length=2, max_length=60)
    email: EmailStr | None = None
    phone: str | None = None
    staff_code: str | None = None  # Employee ID
    designation: str | None = None
    department: str | None = None
    role: Literal["admin", "staff"] | None = None
    status: Literal["active", "inactive", "suspended"] | None = None
    is_active: bool | None = None
    must_change_password: bool | None = None
    joined_on: date | None = None
    permissions: dict[str, list[str]] | None = None


class StaffPasswordReset(BaseModel):
    temporary_password: str = Field(min_length=8, max_length=128)
    require_password_change: bool = True

    @field_validator("temporary_password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Temporary password must include at least one letter and one number.")
        return value


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    designation: str | None = None


class CompanySettings(BaseModel):
    company_name: str | None = None
    company_email: str | None = None
    company_phone: str | None = None
    company_website: str | None = None
    company_address: str | None = None
    company_logo: str | None = None
    company_tagline: str | None = None
    proposal_footer: str | None = None
    currency: str | None = None
    date_format: str | None = None
    timezone: str | None = None
    followup_reminder_days: int | None = Field(default=None, ge=0, le=30)
    default_followup_method: str | None = None
    staff_permissions: list[str] | None = None


class ConversationCreate(BaseModel):
    subject: str = Field(min_length=2, max_length=200)
    category: str = Field(default="general_query", max_length=40)
    priority: Literal["normal", "important", "urgent"] = "normal"
    is_announcement: bool = False
    is_pinned: bool = False
    target_audience: Literal["all_staff", "selected_staff", "role", "direct"] = "direct"
    recipient_ids: list[int] = Field(default_factory=list)
    target_role: str | None = None
    content: str = Field(min_length=1)
    attachment_url: str | None = None
    attachment_name: str | None = None
    attachment_size: int | None = None
    attachment_type: str | None = None


class MessageReply(BaseModel):
    content: str = Field(min_length=1)
    attachment_url: str | None = None
    attachment_name: str | None = None
    attachment_size: int | None = None
    attachment_type: str | None = None


class ConversationUpdate(BaseModel):
    is_pinned: bool | None = None
    is_archived: bool | None = None
    status: Literal["active", "archived"] | None = None

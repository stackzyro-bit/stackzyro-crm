export type Role = "admin" | "staff";
export type AccountStatus = "active" | "inactive" | "suspended";

export interface User {
  id: number;
  staff_code: string;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  role: Role;
  status: AccountStatus;
  is_active: boolean;
  must_change_password?: boolean;
  joined_on: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  permissions?: Record<string, string[]>;
  initials: string;
  lead_count?: number;
  call_count?: number;
}

export interface AuditLog {
  id: number;
  actor_id: number | null;
  actor: User | null;
  action: string;
  category: string;
  description: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_ref: string | null;
  previous_state: Record<string, any> | null;
  new_state: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface CrmModule {
  key: string;
  label: string;
  actions: string[];
}

export function hasPermission(
  user: User | null | undefined,
  module: string,
  action: string = "view"
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!user.is_active || user.status !== "active") return false;
  if (module === "dashboard" || module === "messages") {
    if (user.permissions && user.permissions[module]) {
      return user.permissions[module].includes("*") || user.permissions[module].includes(action);
    }
    return true;
  }
  const moduleActions = user.permissions?.[module];
  if (!moduleActions) return false;
  return moduleActions.includes("*") || moduleActions.includes(action);
}

export interface ServiceRef {
  id: number;
  name: string;
}

export type LeadStatus =
  | "new"
  | "interested"
  | "not_interested"
  | "accepted"
  | "proposal_required"
  | "converted";

export type CallOutcome =
  | "interested"
  | "not_interested"
  | "not_taken"
  | "call_back_requested"
  | "accepted"
  | "proposal_required"
  | "do_not_contact";

export interface Lead {
  id: number;
  code: string;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  category: string | null;
  website: string | null;
  social_links: string | null;
  source: string | null;
  requirements: string | null;
  notes: string | null;
  status: LeadStatus;
  assigned_staff_id: number | null;
  assigned_staff: User | null;
  services: ServiceRef[];
  next_follow_up: string | null;
  created_by: User | null;
  created_at: string;
  updated_at: string;
  calls?: CallRecord[];
  follow_ups?: FollowUp[];
  meetings?: Meeting[];
  proposals?: Proposal[];
  client?: Client | null;
}

export interface CallRecord {
  id: number;
  code: string;
  lead_id: number;
  lead_code: string | null;
  business_name: string | null;
  staff_id: number | null;
  staff: User | null;
  called_at: string;
  outcome: CallOutcome;
  notes: string | null;
  next_follow_up: string | null;
  created_at: string;
}

export type FollowUpStatus = "pending" | "completed" | "cancelled" | "overdue";

export interface FollowUp {
  id: number;
  code: string;
  lead_id: number;
  lead_code: string | null;
  business_name: string | null;
  contact_person: string | null;
  phone: string | null;
  staff_id: number | null;
  staff: User | null;
  due_at: string;
  method: "call" | "whatsapp" | "email" | "meeting" | "visit";
  notes: string | null;
  status: FollowUpStatus;
  stored_status: "pending" | "completed" | "cancelled";
  completed_at: string | null;
  created_at: string;
}

export type ProposalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

export interface PricingRow {
  item: string;
  description?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
}

export interface ProposalContent {
  overview: string;
  requirements: string[];
  scope: string[];
  deliverables: string[];
  timeline: TimelinePhase[];
  pricing: PricingRow[];
  subtotal: number;
  discount: number;
  tax_rate: number;
  total: number;
  payment_terms: string;
  additional_costs: string;
  support_terms?: string;
  tech_stack?: string[];
  terms: string[];
  valid_until: string | null;
  client_location?: string;
  client_email?: string;
  client_phone?: string;
}

export interface Proposal {
  id: number;
  code: string;
  lead_id: number;
  lead_code: string | null;
  business_name: string | null;
  contact_person: string | null;
  phone?: string | null;
  email?: string | null;
  client_id: number | null;
  title: string;
  service_type: string | null;
  status: ProposalStatus;
  amount: number;
  template_key: string | null;
  created_by: User | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  decided_at: string | null;
  content?: ProposalContent;
}

export interface ProposalTemplate {
  key: string;
  name: string;
  service: string;
  title: string;
  overview: string;
  scope: string[];
  deliverables: string[];
  timeline: TimelinePhase[];
  tech_stack?: string[];
  pricing?: PricingRow[];
  terms: string[];
  payment_terms: string;
  additional_costs: string;
  support_terms?: string;
  is_default?: boolean;
  is_custom?: boolean;
  updated_at?: string | null;
}

export type MeetingStatus = "scheduled" | "completed" | "rescheduled" | "cancelled";

export interface Meeting {
  id: number;
  code: string;
  lead_id: number;
  lead_code: string | null;
  business_name: string | null;
  contact_person: string | null;
  phone: string | null;
  staff_id: number | null;
  staff: User | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_type: "google_meet" | "on_site" | "phone";
  location: string | null;
  status: MeetingStatus;
  notes: string | null;
  created_at: string;
}

export type ProjectStatus = "in_progress" | "on_hold" | "completed" | "cancelled";

export interface Client {
  id: number;
  code: string;
  lead_id: number | null;
  lead_code: string | null;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  services: string | null;
  start_date: string | null;
  project_status: ProjectStatus;
  assigned_staff_id: number | null;
  assigned_staff: User | null;
  notes: string | null;
  created_at: string;
}

export interface AttendanceSession {
  id: number;
  user_id: number;
  work_date: string;
  session_number: number;
  check_in: string | null;
  check_out: string | null;
  check_out_reason: string | null;
  check_out_note: string | null;
  check_in_note: string | null;
  working_seconds: number | null;
  working_duration: string | null;
  break_seconds: number | null;
  break_duration: string | null;
  status: "active" | "completed" | "missing_checkout" | "flagged";
  is_manual: boolean;
  correction_reason: string | null;
  corrected_by: User | null;
  created_at: string;
}

export interface Attendance {
  id: number;
  user_id: number;
  staff: User;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  working_hours: number | null;
  total_working_seconds?: number;
  working_duration?: string;
  total_break_seconds?: number;
  break_duration?: string;
  exit_count?: number;
  is_flagged?: boolean;
  flag_reason?: string | null;
  status: "present" | "absent" | "leave" | "half_day";
  note: string | null;
  sessions?: AttendanceSession[];
}

export interface TodayAttendanceStatus {
  work_date: string;
  staff: User;
  current_status: "checked_in" | "checked_out" | "not_started";
  is_checked_in: boolean;
  active_session: AttendanceSession | null;
  first_check_in: string | null;
  latest_check_in: string | null;
  latest_check_out: string | null;
  total_working_seconds: number;
  working_duration: string;
  total_break_seconds: number;
  break_duration: string;
  exit_count: number;
  completed_sessions_count: number;
  is_flagged: boolean;
  flag_reason: string | null;
  sessions: AttendanceSession[];
  reasons_list: string[];
}

export interface LiveBoardItem {
  staff: User;
  live_status: "working" | "on_break" | "not_checked_in";
  last_reason: string | null;
  first_check_in: string | null;
  latest_check_out: string | null;
  total_working_seconds: number;
  working_duration: string;
  total_break_seconds: number;
  break_duration: string;
  exit_count: number;
  is_flagged: boolean;
}

export interface AttendanceSummaryPayload {
  date: string;
  present: number;
  absent: number;
  leave: number;
  currently_working: number;
  currently_on_break: number;
  total_staff: number;
  flagged_count: number;
  records: Record<string, number>;
  live_board: LiveBoardItem[];
  my_record: TodayAttendanceStatus | null;
}

export type ActivityType =
  | "lead_added"
  | "call_completed"
  | "followup_scheduled"
  | "followup_completed"
  | "proposal_created"
  | "proposal_sent"
  | "proposal_accepted"
  | "proposal_rejected"
  | "meeting_scheduled"
  | "client_converted"
  | "lead_converted"
  | "staff_added"
  | "lead_deleted"
  | string;

export interface Activity {
  id: number;
  type: ActivityType;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: number | null;
  actor: User | null;
  created_at: string;
}

export interface Meta {
  services: ServiceRef[];
  staff: User[];
  lead_statuses: LeadStatus[];
  call_outcomes: CallOutcome[];
  followup_methods: string[];
  proposal_statuses: ProposalStatus[];
  project_statuses: ProjectStatus[];
  meeting_types: string[];
  meeting_statuses: MeetingStatus[];
  attendance_statuses: string[];
  lead_sources: string[];
  staff_permissions: string[];
  proposal_templates: ProposalTemplate[];
  company: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    logo: string;
    currency: string;
    proposal_footer: string;
  };
  sample_data: boolean;
  database: string;
  current_user: User;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Metric {
  value: number;
  previous?: number | null;
  last_30_days?: number;
}

export interface CallActivityPoint {
  label: string;
  date: string;
  total: number;
  answered: number;
  not_taken: number;
}

export interface AttendanceRow {
  staff: User;
  status: "present" | "absent" | "leave" | "half_day";
  check_in: string | null;
  check_out: string | null;
}

export interface DashboardData {
  role: Role;
  metrics: Record<string, Metric>;
  call_activity: {
    daily: CallActivityPoint[];
    weekly: CallActivityPoint[];
  };
  lead_status_overview: Record<string, number>;
  today_followups: FollowUp[];
  upcoming_followups?: FollowUp[];
  staff_attendance?: AttendanceRow[];
  attendance_summary?: {
    present: number;
    absent: number;
    leave: number;
    total_staff: number;
  };
  recent_activities: Activity[];
  recent_logins?: AuditLog[];
  staff_performance?: Array<{
    staff: User;
    assigned_leads: number;
    calls_logged: number;
    attendance_today: string;
  }>;
  today_calls: number;
  attendance_today?: Attendance | null;
  upcoming_meetings?: Meeting[];
  generated_at: string;
}

export interface ReportStaffRow {
  staff_id: number;
  name: string;
  designation: string | null;
  is_active: boolean;
  leads: number;
  calls: number;
  interested: number;
  not_interested: number;
  not_taken: number;
  accepted: number;
  followups_total: number;
  followups_completed: number;
  followup_rate: number;
  present_days: number;
}

export interface ReportData {
  preset: string;
  label: string;
  date_from: string;
  date_to: string;
  generated_at: string;
  leads: {
    total: number;
    new: number;
    interested: number;
    not_interested: number;
    accepted: number;
    proposal_required: number;
    converted: number;
    conversion_rate: number;
  };
  calls: {
    total: number;
    not_taken: number;
    interested: number;
    not_interested: number;
    accepted: number;
    call_back_requested: number;
    proposal_required: number;
    do_not_contact: number;
    answered: number;
    by_outcome: Record<string, number>;
  };
  proposals: {
    required: number;
    total: number;
    drafted: number;
    pending: number;
    approved: number;
    sent: number;
    accepted: number;
    rejected: number;
    expired: number;
    by_status: Record<string, number>;
  };
  attendance: {
    present: number;
    absent: number;
    leave: number;
    half_day: number;
    records: number;
  };
  followups: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
    completion_rate: number;
  };
  staff: ReportStaffRow[];
  sources: { source: string; count: number }[];
}

export interface RoleInfo {
  role: string;
  label: string;
  description: string;
  permissions: Record<string, string[]>;
}

export interface SettingsData {
  company: Record<string, string>;
  preferences: Record<string, string | number>;
  security?: {
    max_login_attempts: number;
    lockout_minutes: number;
    session_timeout_mins: number;
    require_strong_passwords: boolean;
  };
  attendance?: {
    work_hours_start: string;
    work_hours_end: string;
    grace_period_mins: number;
    half_day_hours: number;
  };
  crm?: {
    default_lead_category: string;
    auto_assign_leads: boolean;
    require_call_outcome: boolean;
  };
  notifications?: {
    email_alerts_enabled: boolean;
    followup_reminder_email: boolean;
    daily_digest_email: boolean;
  };
  roles?: RoleInfo[];
  permissions: string[];
  profile: User;
  sample_data: boolean;
  database: string;
}

export type MessagePriority = "normal" | "important" | "urgent";

export interface MessageReceipt {
  id: number;
  message_id: number;
  user_id: number;
  is_delivered: boolean;
  delivered_at: string;
  is_read: boolean;
  read_at: string | null;
  user?: User | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender: User;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_type: string | null;
  created_at: string;
  receipts?: MessageReceipt[];
}

export interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  user: User;
  role: string;
  last_read_at: string | null;
  is_archived: boolean;
}

export interface Conversation {
  id: number;
  code: string;
  subject: string;
  category: string;
  priority: MessagePriority;
  is_announcement: boolean;
  is_pinned: boolean;
  target_audience: "all_staff" | "selected_staff" | "role" | "direct";
  target_role: string | null;
  created_by_id: number;
  created_by: User;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  participants: ConversationParticipant[];
  messages: Message[];
  unread_count?: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_name: string;
  } | null;
}

export interface UnreadMessageCount {
  total_unread: number;
  unread_messages: number;
  unread_announcements: number;
  urgent_unread: number;
}

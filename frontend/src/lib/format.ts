export type Tone = "purple" | "green" | "amber" | "red" | "grey" | "blue" | "teal";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  interested: "Interested",
  not_interested: "Not interested",
  accepted: "Accepted",
  proposal_required: "Proposal required",
  converted: "Converted",
};

export const CALL_OUTCOME_LABELS: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  not_taken: "Not taken",
  call_back_requested: "Call back requested",
  accepted: "Accepted",
  proposal_required: "Proposal required",
  do_not_contact: "Do not contact",
};

export const FOLLOWUP_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  leave: "On leave",
  half_day: "Half day",
};

export const MEETING_TYPE_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  on_site: "On-site",
  phone: "Phone call",
};

export const METHOD_LABELS: Record<string, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  visit: "Visit",
};

export const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  cold_call: "Cold call",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  google: "Google",
  walk_in: "Walk-in",
  event: "Event",
  other: "Other",
};

export const PERMISSION_LABELS: Record<string, string> = {
  create_leads: "Create and edit assigned leads",
  record_calls: "Record calls and call outcomes",
  manage_followups: "Manage follow-ups and reschedule",
  create_proposals: "Create and edit proposals",
  schedule_meetings: "Schedule meetings",
  view_clients: "View assigned client accounts",
};

export function labelFor(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusTone(value: string | null | undefined): Tone {
  switch (value) {
    case "interested":
    case "accepted":
    case "approved":
    case "completed":
    case "present":
      return "green";
    case "new":
    case "call_back_requested":
    case "sent":
    case "scheduled":
    case "in_progress":
    case "half_day":
      return "blue";
    case "proposal_required":
    case "pending":
    case "pending_approval":
    case "rescheduled":
    case "leave":
    case "on_hold":
      return "amber";
    case "not_interested":
    case "rejected":
    case "overdue":
    case "absent":
      return "red";
    case "converted":
      return "teal";
    case "cancelled":
    case "expired":
    case "do_not_contact":
      return "grey";
    default:
      return "purple";
  }
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined, fallback = "—"): string {
  const date = parse(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(value: string | null | undefined, fallback = "—"): string {
  const date = parse(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

export function formatTime(value: string | null | undefined, fallback = "—"): string {
  const date = parse(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDateTime(value: string | null | undefined, fallback = "—"): string {
  const date = parse(value);
  if (!date) return fallback;
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function formatCurrency(value: number | string | null | undefined, currency = "INR"): string {
  const amount = typeof value === "string" ? Number(value) : value ?? 0;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }
}

export function formatNumber(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("en-IN").format(Number.isFinite(amount) ? amount : 0);
}

export function relativeTime(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return "—";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of thresholds) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

export function initials(name: string | null | undefined): string {
  if (!name) return "SZ";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function toDateTimeInput(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function toDateInput(value: Date | string = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isSameDay(a: string | null | undefined, b: Date): boolean {
  const date = parse(a);
  if (!date) return false;
  return (
    date.getFullYear() === b.getFullYear() &&
    date.getMonth() === b.getMonth() &&
    date.getDate() === b.getDate()
  );
}

export function isToday(value: string | null | undefined): boolean {
  return isSameDay(value, new Date());
}

export function isPast(value: string | null | undefined): boolean {
  const date = parse(value);
  return date ? date.getTime() < Date.now() : false;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function monthTitle(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(value);
}

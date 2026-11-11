import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  LogIn,
  LogOut,
  PhoneCall,
  PhoneMissed,
  Plus,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { RecordCallModal } from "../components/calls/RecordCallModal";
import { LeadFormModal } from "../components/leads/LeadFormModal";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { AnnouncementsWidget } from "../components/dashboard/AnnouncementsWidget";
import { RecentMessagesWidget } from "../components/dashboard/RecentMessagesWidget";
import { Avatar } from "../components/ui/Avatar";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { ListSkeleton, CardSkeleton } from "../components/ui/Skeleton";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  ATTENDANCE_STATUS_LABELS,
  CALL_OUTCOME_LABELS,
  FOLLOWUP_STATUS_LABELS,
  MEETING_TYPE_LABELS,
  formatDate,
  formatTime,
  greeting,
  labelFor,
  relativeTime,
  type Tone,
} from "../lib/format";
import type { Activity, Attendance, DashboardData, Metric } from "../lib/types";

interface SummaryCard {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  footnote?: (metric: Metric | undefined) => string | undefined;
}

const ADMIN_CARDS: SummaryCard[] = [
  {
    key: "total_leads",
    label: "Total leads",
    icon: Users,
    tone: "purple",
    footnote: (metric) =>
      metric?.last_30_days !== undefined ? `${metric.last_30_days} in last 30 days` : undefined,
  },
  { key: "new_leads", label: "New leads", icon: UserPlus, tone: "blue" },
  { key: "interested", label: "Interested leads", icon: UserCheck, tone: "green" },
  { key: "followups_pending", label: "Follow-ups pending", icon: CalendarClock, tone: "amber" },
  { key: "meetings_scheduled", label: "Meetings scheduled", icon: CalendarDays, tone: "teal" },
  { key: "proposals_sent", label: "Proposals sent", icon: Send, tone: "purple" },
  { key: "accepted_proposals", label: "Accepted proposals", icon: CheckCircle2, tone: "green" },
  { key: "converted_clients", label: "Converted clients", icon: Building2, tone: "teal" },
  { key: "total_staff", label: "Total staff", icon: Users, tone: "purple" },
];

const STAFF_CARDS: SummaryCard[] = [
  { key: "my_leads", label: "My assigned leads", icon: Users, tone: "purple" },
  { key: "my_calls_today", label: "My calls today", icon: PhoneCall, tone: "blue" },
  { key: "interested", label: "Interested leads", icon: UserCheck, tone: "green" },
  { key: "my_followups", label: "Pending follow-ups", icon: CalendarClock, tone: "amber" },
  { key: "accepted", label: "Accepted leads", icon: CheckCircle2, tone: "teal" },
  { key: "my_proposals", label: "My proposals", icon: FileText, tone: "purple" },
];

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  lead_added: UserPlus,
  call_completed: PhoneCall,
  followup_scheduled: CalendarClock,
  followup_completed: CalendarClock,
  proposal_created: FileText,
  proposal_sent: Send,
  proposal_accepted: CheckCircle2,
  proposal_rejected: FileText,
  meeting_scheduled: CalendarDays,
  client_converted: Building2,
  lead_converted: Building2,
};

const STATUS_BARS: { key: string; label: string; className: string }[] = [
  { key: "interested", label: "Interested", className: "bg-emerald-500" },
  { key: "not_interested", label: "Not interested", className: "bg-rose-400" },
  { key: "accepted", label: "Accepted", className: "bg-teal-500" },
  { key: "proposal_required", label: "Proposal required", className: "bg-amber-400" },
  { key: "converted", label: "Converted", className: "bg-brand-500" },
];

function ActivityFeed({ items }: { items: Activity[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity recorded yet"
        description="Lead, call and proposal actions will appear here as the team works."
      />
    );
  }
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      {items.map((activity) => {
        const Icon = ACTIVITY_ICONS[activity.type] ?? ActivityIcon;
        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 border-b border-line py-3 last:border-0 sm:[&:nth-last-child(2)]:border-0"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium leading-snug text-ink-800">{activity.title}</p>
              <p className="mt-0.5 truncate text-[10.5px] text-ink-400">
                {activity.actor?.name ? `${activity.actor.name} · ` : ""}
                {relativeTime(activity.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CallActivityCard({ data }: { data: DashboardData }) {
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const series = range === "daily" ? data.call_activity.daily : data.call_activity.weekly;
  const totals = series.reduce(
    (acc, point) => ({
      total: acc.total + point.total,
      answered: acc.answered + point.answered,
      notTaken: acc.notTaken + point.not_taken,
    }),
    { total: 0, answered: 0, notTaken: 0 }
  );

  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="Call activity"
        subtitle={range === "daily" ? "Last 7 days" : "Last 6 weeks"}
        action={
          <Tabs
            items={[
              { key: "daily", label: "Daily" },
              { key: "weekly", label: "Weekly" },
            ]}
            value={range}
            onChange={(value) => setRange(value as "daily" | "weekly")}
          />
        }
      />
      <CardBody className="pt-3">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Total calls</p>
            <p className="text-lg font-semibold tabular text-ink-900">{totals.total}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Answered</p>
            <p className="text-lg font-semibold tabular text-brand-700">{totals.answered}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Not taken</p>
            <p className="text-lg font-semibold tabular text-amber-600">{totals.notTaken}</p>
          </div>
        </div>
        <div className="h-[248px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0edf6" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10.5, fill: "#918ba3" }}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10.5, fill: "#918ba3" }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #eae6f2",
                  boxShadow: "0 12px 30px -18px rgba(29,26,43,.35)",
                  fontSize: 11,
                  padding: "8px 10px",
                }}
                labelStyle={{ fontWeight: 600, color: "#1d1a2b", marginBottom: 4 }}
                cursor={{ fill: "#faf8ff" }}
              />
              <Legend
                verticalAlign="bottom"
                height={26}
                iconType="circle"
                iconSize={7}
                wrapperStyle={{ fontSize: 10.5, color: "#736d88" }}
              />
              <Bar dataKey="total" name="Total calls" fill="#e6d9fd" radius={[4, 4, 0, 0]} barSize={20} />
              <Line
                type="monotone"
                dataKey="answered"
                name="Answered"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#7c3aed", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="not_taken"
                name="Not taken"
                stroke="#f59e0b"
                strokeWidth={1.8}
                strokeDasharray="4 3"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function LeadStatusCard({ overview }: { overview: Record<string, number> }) {
  const total = Object.values(overview).reduce((sum, value) => sum + value, 0);
  const max = Math.max(...Object.values(overview), 1);
  return (
    <Card>
      <CardHeader
        title="Lead status overview"
        subtitle={`${total} leads in the pipeline`}
        action={
          <Link
            to="/leads"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-800"
          >
            All leads
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />
      <CardBody className="space-y-3.5">
        {STATUS_BARS.map((row) => {
          const count = overview[row.key] ?? 0;
          const percentage = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[11.5px] text-ink-600">
                  <span className={`h-1.5 w-1.5 rounded-full ${row.className}`} />
                  {row.label}
                </span>
                <span className="text-[11px] font-semibold tabular text-ink-800">
                  {count}
                  <span className="ml-1 font-normal text-ink-400">{percentage}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f3f0f9]">
                <div
                  className={`h-full rounded-full ${row.className}`}
                  style={{ width: `${Math.max((count / max) * 100, count > 0 ? 6 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
        {total === 0 ? (
          <p className="pt-1 text-center text-[11px] text-ink-400">No lead status data yet.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [activeCallLead, setActiveCallLead] = useState<number | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<string>("all");
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [checkOutReason, setCheckOutReason] = useState("Lunch Break");
  const [checkOutNote, setCheckOutNote] = useState("");

  const load = useCallback(async () => {
    try {
      const now = new Date();
      let df: string | undefined = undefined;
      let dt: string | undefined = undefined;
      if (filterRange === "today") {
        df = now.toISOString().split("T")[0];
        dt = df;
      } else if (filterRange === "7d") {
        const d = new Date(now.getTime() - 7 * 86400000);
        df = d.toISOString().split("T")[0];
        dt = now.toISOString().split("T")[0];
      } else if (filterRange === "30d") {
        const d = new Date(now.getTime() - 30 * 86400000);
        df = d.toISOString().split("T")[0];
        dt = now.toISOString().split("T")[0];
      }

      const payload = await api.get<DashboardData>("/dashboard", {
        staff_id: filterStaff === "all" ? undefined : Number(filterStaff),
        date_from: df,
        date_to: dt,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load dashboard", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [filterStaff, filterRange, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCheckIn = async () => {
    setAttendanceBusy(true);
    try {
      await api.post("/attendance/check-in");
      toast.success("Checked In Successfully");
      void load();
    } catch (err) {
      toast.error("Could not check in", err instanceof Error ? err.message : undefined);
    } finally {
      setAttendanceBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!checkOutReason) {
      toast.error("Select an exit reason");
      return;
    }
    setAttendanceBusy(true);
    try {
      await api.post("/attendance/check-out", {
        reason: checkOutReason,
        note: checkOutNote.trim() || undefined,
      });
      toast.success("Checked Out Successfully", `Reason: ${checkOutReason}`);
      setCheckOutModalOpen(false);
      setCheckOutNote("");
      void load();
    } catch (err) {
      toast.error("Could not check out", err instanceof Error ? err.message : undefined);
    } finally {
      setAttendanceBusy(false);
    }
  };

  const isStaff = user?.role === "staff";
  const cards = isStaff ? STAFF_CARDS : ADMIN_CARDS;
  const attendance = data?.attendance_today ?? null;
  const sessions = attendance?.sessions || [];
  const activeSession = sessions.find((s) => s.status === "active" && !s.check_out);
  const isWorking = Boolean(activeSession);
  const hasEverCheckedIn = Boolean(attendance?.check_in);
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-600">
              {greeting()}
            </p>
            {meta?.sample_data ? <Badge tone="amber">Sample data</Badge> : null}
          </div>
          <h1 className="mt-1 text-[21px] font-semibold tracking-[-0.02em] text-ink-900">
            {user?.name?.split(" ")[0]}'s overview
          </h1>
          <p className="mt-0.5 text-[11.5px] text-ink-400">{todayLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleHelpButton moduleKey="dashboard" label="Dashboard Guide" />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PhoneCall className="h-3.5 w-3.5" />}
            onClick={() => {
              setActiveCallLead(null);
              setCallModalOpen(true);
            }}
          >
            Record call
          </Button>
          <Button
            size="sm"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setLeadModalOpen(true)}
          >
            Add lead
          </Button>
        </div>
      </div>

      {/* Admin Filter Toolbar */}
      {!isStaff && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-ink-700">Filter overview:</span>
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "All time" },
                { id: "today", label: "Today" },
                { id: "7d", label: "Last 7 days" },
                { id: "30d", label: "Last 30 days" },
              ].map((range) => (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => setFilterRange(range.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    filterRange === range.id
                      ? "bg-brand-600 text-white shadow-xs"
                      : "text-ink-600 hover:bg-ink-100/60"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="staff-filter" className="text-[11.5px] font-medium text-ink-500">
              Staff:
            </label>
            <select
              id="staff-filter"
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-800 shadow-xs focus:border-brand-500 focus:outline-hidden"
            >
              <option value="all">All staff members</option>
              {meta?.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.designation || s.role})
                </option>
              ))}
            </select>
            {(filterRange !== "all" || filterStaff !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setFilterRange("all");
                  setFilterStaff("all");
                }}
                className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {isStaff ? (
        <Card className="mb-4 overflow-hidden border-brand-100 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isWorking
                    ? "bg-emerald-50 text-emerald-600"
                    : hasEverCheckedIn
                    ? "bg-amber-50 text-amber-600"
                    : "bg-brand-50 text-brand-600"
                }`}
              >
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[12.5px] font-semibold text-ink-900">Today's Attendance</p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {isWorking
                    ? `Checked in at ${formatTime(activeSession?.check_in)} · Work: ${
                        attendance?.working_duration || "0m"
                      } · ${attendance?.exit_count || 0} exit(s)`
                    : hasEverCheckedIn
                    ? `Currently on break / out of office · Work: ${
                        attendance?.working_duration || "0m"
                      } · ${attendance?.exit_count || 0} exit(s)`
                    : "You have not checked in yet today."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                tone={isWorking ? "green" : hasEverCheckedIn ? "amber" : "grey"}
                dot
              >
                {isWorking
                  ? `In Office (Session #${activeSession?.session_number || 1})`
                  : hasEverCheckedIn
                  ? "On Break / Out of Office"
                  : "Not Checked In"}
              </Badge>
              {!isWorking ? (
                <Button
                  size="sm"
                  loading={attendanceBusy}
                  leftIcon={<LogIn className="h-3.5 w-3.5" />}
                  onClick={handleCheckIn}
                >
                  {hasEverCheckedIn ? "Check In (Return)" : "Check In"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  loading={attendanceBusy}
                  leftIcon={<LogOut className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setCheckOutReason("Lunch Break");
                    setCheckOutNote("");
                    setCheckOutModalOpen(true);
                  }}
                >
                  Check Out
                </Button>
              )}
              <Link to="/attendance">
                <Button size="sm" variant="ghost">
                  Timeline
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <AnnouncementsWidget />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {loading
          ? cards.map((card) => <CardSkeleton key={card.key} />)
          : cards.map((card) => {
              const metric = data?.metrics?.[card.key];
              return (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={metric?.value ?? 0}
                  icon={card.icon}
                  tone={card.tone}
                  footnote={card.footnote?.(metric)}
                />
              );
            })}
      </div>

      {loading || !data ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="h-[360px] xl:col-span-2">
            <ListSkeleton rows={4} />
          </Card>
          <Card className="h-[360px]">
            <ListSkeleton rows={4} />
          </Card>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <CallActivityCard data={data} />
            <LeadStatusCard overview={data.lead_status_overview} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Today's follow-ups"
                subtitle={`${data.today_followups.length} scheduled for today`}
                action={
                  <Link
                    to="/followups"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-800"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
              {data.today_followups.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No follow-ups today"
                  description="Schedule the next step from a lead record or a call."
                  action={
                    <Link to="/followups">
                      <Button size="sm" variant="outline">
                        Open follow-ups
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-line">
                  {data.today_followups.slice(0, 5).map((followUp) => (
                    <div
                      key={followUp.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-[#fcfbfe]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold text-ink-900">
                          {followUp.business_name}
                        </p>
                        <p className="mt-0.5 truncate text-[10.5px] text-ink-400">
                          {followUp.lead_code} · {followUp.staff?.name ?? "Unassigned"} ·{" "}
                          {formatTime(followUp.due_at)}
                        </p>
                      </div>
                      <StatusBadge value={followUp.status} labels={FOLLOWUP_STATUS_LABELS} />
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<PhoneCall className="h-3 w-3" />}
                        onClick={() => {
                          setActiveCallLead(followUp.lead_id);
                          setCallModalOpen(true);
                        }}
                      >
                        Log call
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {isStaff ? (
              <Card>
                <CardHeader
                  title="Upcoming meetings"
                  subtitle="Next booked conversations"
                  action={
                    <Link
                      to="/meetings"
                      className="text-[11px] font-medium text-brand-700 hover:text-brand-800"
                    >
                      View all
                    </Link>
                  }
                />
                {(data.upcoming_meetings ?? []).length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No meetings scheduled"
                    description="Book a Google Meet, on-site visit or phone call from the Meetings page."
                  />
                ) : (
                  <div className="divide-y divide-line">
                    {(data.upcoming_meetings ?? []).map((meeting) => {
                      const date = new Date(meeting.scheduled_at);
                      return (
                        <div key={meeting.id} className="flex items-start gap-3 px-5 py-3">
                          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                            <span className="text-[13px] font-bold leading-none">
                              {date.getDate()}
                            </span>
                            <span className="mt-0.5 text-[8px] uppercase leading-none">
                              {new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold text-ink-900">
                              {meeting.business_name}
                            </p>
                            <p className="mt-0.5 text-[10.5px] text-ink-400">
                              {formatTime(meeting.scheduled_at)} ·{" "}
                              {labelFor(MEETING_TYPE_LABELS, meeting.meeting_type)}
                            </p>
                          </div>
                          {meeting.location?.startsWith("http") ? (
                            <a
                              href={meeting.location}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-line px-2 py-1 text-[10px] font-medium text-brand-700 transition-colors hover:bg-brand-50"
                            >
                              Join
                            </a>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <Card>
                <CardHeader
                  title="Staff attendance"
                  subtitle="Today's check-ins"
                  action={
                    <Link
                      to="/attendance"
                      className="text-[11px] font-medium text-brand-700 hover:text-brand-800"
                    >
                      Manage
                    </Link>
                  }
                />
                {(data.staff_attendance ?? []).length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No staff records"
                    description="Add staff members to start tracking attendance."
                  />
                ) : (
                  <div className="divide-y divide-line">
                    {(data.staff_attendance ?? []).slice(0, 5).map((row) => (
                      <div key={row.staff.id} className="flex items-center gap-3 px-5 py-2.5">
                        <Avatar name={row.staff.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11.5px] font-medium text-ink-800">
                            {row.staff.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-400">
                            {row.check_in
                              ? `In ${formatTime(row.check_in)}${
                                  row.check_out ? ` · Out ${formatTime(row.check_out)}` : ""
                                }`
                              : "Not checked in"}
                          </p>
                        </div>
                        <StatusBadge value={row.status} labels={ATTENDANCE_STATUS_LABELS} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {!isStaff && (
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader
                  title="Staff-wise performance"
                  subtitle="Assigned leads, calls logged and attendance status"
                  action={
                    <Link
                      to="/reports"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-800"
                    >
                      Full report
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  }
                />
                {!data.staff_performance || data.staff_performance.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No staff performance data"
                    description="Active staff members and their stats will appear here."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-line bg-ink-50/50 text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">
                          <th className="px-5 py-2.5">Staff Member</th>
                          <th className="px-3 py-2.5">Department / Role</th>
                          <th className="px-3 py-2.5 text-center">Assigned Leads</th>
                          <th className="px-3 py-2.5 text-center">Calls Logged</th>
                          <th className="px-5 py-2.5 text-right">Attendance Today</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.staff_performance.map((sp) => (
                          <tr key={sp.staff.id} className="transition-colors hover:bg-[#fcfbfe]">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={sp.staff.name} size="sm" />
                                <div>
                                  <p className="font-semibold text-ink-900 leading-tight">
                                    {sp.staff.name}
                                  </p>
                                  <p className="text-[10px] text-ink-400">
                                    @{sp.staff.username || sp.staff.email.split("@")[0]}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-ink-600">
                              <span className="capitalize">
                                {sp.staff.designation || sp.staff.department || sp.staff.role}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="inline-flex items-center justify-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                                {sp.assigned_leads}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="inline-flex items-center justify-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                {sp.calls_logged}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Badge
                                tone={
                                  sp.attendance_today === "present"
                                    ? "green"
                                    : sp.attendance_today === "half_day"
                                    ? "blue"
                                    : sp.attendance_today === "leave"
                                    ? "amber"
                                    : "grey"
                                }
                                dot
                              >
                                {labelFor(ATTENDANCE_STATUS_LABELS, sp.attendance_today)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Recent login activity"
                  subtitle="Authentication audit log"
                  action={
                    <Link
                      to="/settings?tab=audit"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-800"
                    >
                      Audit logs
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  }
                />
                {!data.recent_logins || data.recent_logins.length === 0 ? (
                  <EmptyState
                    icon={LogIn}
                    title="No login records"
                    description="Authentication events will appear here."
                  />
                ) : (
                  <div className="divide-y divide-line">
                    {data.recent_logins.map((entry) => {
                      const isSuccess = entry.action === "login_success";
                      return (
                        <div key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
                          <Avatar
                            name={entry.actor?.name || entry.entity_ref || "User"}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[11.5px] font-medium text-ink-900">
                                {entry.actor?.name || entry.entity_ref || "System"}
                              </p>
                              <Badge tone={isSuccess ? "green" : "red"}>
                                {isSuccess ? "Success" : "Failed"}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-[10px] text-ink-400">
                              {entry.ip_address ? `${entry.ip_address} · ` : ""}
                              {relativeTime(entry.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <RecentMessagesWidget />
            </div>
            <Card className="xl:col-span-2">
              <CardHeader
                title="Recent activities"
                subtitle={isStaff ? "Your latest updates" : "Across leads, calls and proposals"}
              />
              <CardBody className="py-1">
                <ActivityFeed items={data.recent_activities} />
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <LeadFormModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSaved={() => void load()}
      />
      <RecordCallModal
        open={callModalOpen}
        onClose={() => {
          setCallModalOpen(false);
          setActiveCallLead(null);
        }}
        leadId={activeCallLead}
        onSaved={() => void load()}
      />

      {/* Check-Out Reason Modal */}
      <Modal
        open={checkOutModalOpen}
        onClose={() => setCheckOutModalOpen(false)}
        title="Check Out / Leave Office"
        description="Select reason for departure. Time tracking will automatically pause until your next check-in."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCheckOutModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckOut}
              loading={attendanceBusy}
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              Confirm Check-Out
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Departure Reason" required>
            <Select
              value={checkOutReason}
              onChange={(e) => setCheckOutReason(e.target.value)}
            >
              <option value="Lunch Break">Lunch Break</option>
              <option value="Tea / Personal Break">Tea / Personal Break</option>
              <option value="Client Meeting">Client Meeting</option>
              <option value="Business Visit">Business Visit</option>
              <option value="Official Work Outside Office">Official Work Outside Office</option>
              <option value="Personal Work">Personal Work</option>
              <option value="End of Day">End of Day</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
          <Field label="Optional Note">
            <Textarea
              rows={2}
              value={checkOutNote}
              onChange={(e) => setCheckOutNote(e.target.value)}
              placeholder="e.g. Client visit at ABC Corp, tea break, etc."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

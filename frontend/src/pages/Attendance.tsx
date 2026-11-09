import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Download,
  Eye,
  Filter,
  History,
  Info,
  Layers,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ActionMenu } from "../components/ui/ActionMenu";
import { Avatar } from "../components/ui/Avatar";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Column, DataTable, Pagination } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  ATTENDANCE_STATUS_LABELS,
  formatDate,
  formatTime,
  labelFor,
  toDateInput,
  toDateTimeInput,
} from "../lib/format";
import type {
  Attendance,
  AttendanceSession,
  AttendanceSummaryPayload,
  LiveBoardItem,
  Paginated,
  TodayAttendanceStatus,
} from "../lib/types";

const PAGE_SIZE = 10;

const DEFAULT_CHECK_OUT_REASONS = [
  "Lunch Break",
  "Tea / Personal Break",
  "Client Meeting",
  "Business Visit",
  "Official Work Outside Office",
  "Personal Work",
  "End of Day",
  "Other",
];

export function AttendancePage() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const isAdmin = user?.role === "admin";

  // Tab management for Admin
  const [activeTab, setActiveTab] = useState<string>("today");

  // Live today's status for the current user
  const [todayStatus, setTodayStatus] = useState<TodayAttendanceStatus | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  // Check-Out Reason Modal
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [checkOutReason, setCheckOutReason] = useState("Lunch Break");
  const [checkOutNote, setCheckOutNote] = useState("");

  // Check-In Note Modal
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInNote, setCheckInNote] = useState("");

  // Summary & Live Board (Admin)
  const [summary, setSummary] = useState<AttendanceSummaryPayload | null>(null);

  // History & Register Table Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - (isAdmin ? 6 : 30));
    return toDateInput(start);
  });
  const [dateTo, setDateTo] = useState(toDateInput());
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Attendance> | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected Timeline Inspection
  const [timelineStaffId, setTimelineStaffId] = useState<number>(user?.id || 1);
  const [timelineDate, setTimelineDate] = useState<string>(toDateInput());
  const [timelineData, setTimelineData] = useState<{
    work_date: string;
    staff: any;
    total_working_seconds: number;
    working_duration: string;
    total_break_seconds: number;
    break_duration: string;
    exit_count: number;
    sessions: AttendanceSession[];
    is_flagged: boolean;
    flag_reason: string | null;
  } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Flagged Sessions (Admin)
  const [flaggedSessions, setFlaggedSessions] = useState<AttendanceSession[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [resolvingSession, setResolvingSession] = useState<AttendanceSession | null>(null);
  const [resolveForm, setResolveForm] = useState({
    check_out: "",
    check_out_reason: "End of Day",
    check_out_note: "",
    resolution_reason: "",
  });

  // Manual Session Add Modal (Admin)
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [manualAddForm, setManualAddForm] = useState({
    user_id: "",
    work_date: toDateInput(),
    check_in: "",
    check_out: "",
    check_out_reason: "Official Work Outside Office",
    check_out_note: "",
    check_in_note: "",
    correction_reason: "",
  });

  // Edit Session Modal (Admin)
  const [editingSession, setEditingSession] = useState<AttendanceSession | null>(null);
  const [editSessionForm, setEditSessionForm] = useState({
    check_in: "",
    check_out: "",
    check_out_reason: "Lunch Break",
    check_out_note: "",
    check_in_note: "",
    correction_reason: "",
  });

  const [saving, setSaving] = useState(false);

  // 1. Load Live Today Status for Current User
  const loadTodayStatus = useCallback(async () => {
    try {
      const res = await api.get<TodayAttendanceStatus>("/attendance/today-status");
      setTodayStatus(res);
    } catch (err) {
      console.error("Could not load today's attendance status", err);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // 2. Load Admin Summary & Live Board
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get<AttendanceSummaryPayload>("/attendance/summary");
      setSummary(res);
    } catch {
      // non-critical
    }
  }, []);

  // 3. Load Register / History
  const loadRegister = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<Attendance>>("/attendance", {
        page,
        page_size: PAGE_SIZE,
        staff_id: staffFilter || (isAdmin ? undefined : user?.id),
        status: statusFilter === "all" ? undefined : statusFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        is_flagged: flagFilter === "all" ? undefined : flagFilter === "true",
      });
      setData(res);
    } catch (err) {
      toast.error("Could not load attendance records", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, staffFilter, statusFilter, flagFilter, dateFrom, dateTo, isAdmin, user?.id, toast]);

  // 4. Load Timeline for Selected Staff & Date
  const loadTimeline = useCallback(
    async (staffId: number, dateStr: string) => {
      setTimelineLoading(true);
      try {
        const res = await api.get<any>("/attendance/daily-timeline", {
          user_id: staffId,
          work_date: dateStr,
        });
        setTimelineData(res);
      } catch (err) {
        toast.error("Could not load timeline", err instanceof Error ? err.message : undefined);
      } finally {
        setTimelineLoading(false);
      }
    },
    [toast]
  );

  // 5. Load Flagged Sessions (Admin)
  const loadFlagged = useCallback(async () => {
    if (!isAdmin) return;
    setFlaggedLoading(true);
    try {
      const res = await api.get<AttendanceSession[]>("/attendance/flagged");
      setFlaggedSessions(res);
    } catch {
      // non-critical
    } finally {
      setFlaggedLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadTodayStatus();
    void loadSummary();
  }, [loadTodayStatus, loadSummary]);

  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);

  useEffect(() => {
    if (activeTab === "timeline") {
      void loadTimeline(timelineStaffId, timelineDate);
    } else if (activeTab === "flagged") {
      void loadFlagged();
    }
  }, [activeTab, timelineStaffId, timelineDate, loadTimeline, loadFlagged]);

  // Handle Check-In
  const handleCheckIn = async () => {
    setActionBusy(true);
    try {
      const updated = await api.post<TodayAttendanceStatus>("/attendance/check-in", {
        note: checkInNote.trim() || undefined,
      });
      setTodayStatus(updated);
      setCheckInOpen(false);
      setCheckInNote("");
      toast.success(
        "Checked In Successfully",
        `Session #${updated.sessions.length} started at ${formatTime(updated.latest_check_in)}`
      );
      void loadSummary();
      void loadRegister();
    } catch (err) {
      toast.error("Check-In Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    if (!checkOutReason) {
      toast.error("Please select a check-out reason");
      return;
    }
    setActionBusy(true);
    try {
      const updated = await api.post<TodayAttendanceStatus>("/attendance/check-out", {
        reason: checkOutReason,
        note: checkOutNote.trim() || undefined,
      });
      setTodayStatus(updated);
      setCheckOutOpen(false);
      setCheckOutNote("");
      toast.success(
        "Checked Out Successfully",
        `Reason: ${checkOutReason} · Latest duration: ${updated.working_duration}`
      );
      void loadSummary();
      void loadRegister();
    } catch (err) {
      toast.error("Check-Out Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  // Resolve Flagged Session
  const handleResolveFlag = async () => {
    if (!resolvingSession) return;
    if (!resolveForm.check_out) {
      toast.error("Enter check-out timestamp");
      return;
    }
    if (!resolveForm.resolution_reason.trim()) {
      toast.error("Mandatory resolution reason is required for audit trail.");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/attendance/resolve-flag/${resolvingSession.id}`, {
        check_out: resolveForm.check_out,
        check_out_reason: resolveForm.check_out_reason,
        check_out_note: resolveForm.check_out_note || undefined,
        resolution_reason: resolveForm.resolution_reason.trim(),
      });
      toast.success("Session flag resolved", `Updated with checkout at ${resolveForm.check_out}`);
      setResolvingSession(null);
      void loadFlagged();
      void loadSummary();
      void loadRegister();
    } catch (err) {
      toast.error("Could not resolve flag", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  // Admin Manual Add Session
  const handleManualAdd = async () => {
    if (!manualAddForm.user_id || !manualAddForm.check_in || !manualAddForm.correction_reason.trim()) {
      toast.error("Staff member, check-in time and mandatory correction reason are required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/attendance/sessions", {
        user_id: Number(manualAddForm.user_id),
        work_date: manualAddForm.work_date,
        check_in: manualAddForm.check_in,
        check_out: manualAddForm.check_out || null,
        check_out_reason: manualAddForm.check_out ? manualAddForm.check_out_reason : null,
        check_out_note: manualAddForm.check_out_note || null,
        check_in_note: manualAddForm.check_in_note || null,
        correction_reason: manualAddForm.correction_reason.trim(),
      });
      toast.success("Authorized session added", `Record created for ${manualAddForm.work_date}`);
      setManualAddOpen(false);
      setManualAddForm({
        user_id: "",
        work_date: toDateInput(),
        check_in: "",
        check_out: "",
        check_out_reason: "Official Work Outside Office",
        check_out_note: "",
        check_in_note: "",
        correction_reason: "",
      });
      void loadSummary();
      void loadRegister();
    } catch (err) {
      toast.error("Could not add session", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  // Admin Edit Session
  const handleEditSession = async () => {
    if (!editingSession) return;
    if (!editSessionForm.correction_reason.trim()) {
      toast.error("Mandatory correction reason is required for compliance audit.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/attendance/sessions/${editingSession.id}`, {
        check_in: editSessionForm.check_in || undefined,
        check_out: editSessionForm.check_out || undefined,
        check_out_reason: editSessionForm.check_out_reason,
        check_out_note: editSessionForm.check_out_note || undefined,
        check_in_note: editSessionForm.check_in_note || undefined,
        correction_reason: editSessionForm.correction_reason.trim(),
      });
      toast.success("Session corrected", `Session #${editingSession.session_number} updated.`);
      setEditingSession(null);
      void loadRegister();
      if (activeTab === "timeline") {
        void loadTimeline(timelineStaffId, timelineDate);
      }
    } catch (err) {
      toast.error("Could not update session", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  // Inspect Timeline Helper
  const openStaffTimeline = (staffId: number, workDate?: string) => {
    setTimelineStaffId(staffId);
    if (workDate) setTimelineDate(workDate);
    setActiveTab("timeline");
  };

  // Register Columns
  const registerColumns: Column<Attendance>[] = [
    {
      key: "date",
      header: "Date",
      render: (r) => (
        <span className="font-medium text-ink-900 whitespace-nowrap">
          {formatDate(r.work_date)}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: "staff",
            header: "Employee",
            render: (r: Attendance) => (
              <div className="flex items-center gap-2.5 min-w-[170px]">
                <Avatar name={r.staff?.name} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900 truncate leading-tight">
                    {r.staff?.name || "Staff"}
                  </p>
                  <p className="text-[10.5px] text-ink-400 truncate">
                    {r.staff?.staff_code || ""} · {r.staff?.department || r.staff?.designation || ""}
                  </p>
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "first_in",
      header: "First In",
      render: (r) => (
        <span className="font-mono text-[12px] text-ink-700">
          {r.check_in ? formatTime(r.check_in) : "—"}
        </span>
      ),
    },
    {
      key: "latest_out",
      header: "Latest Out",
      render: (r) => (
        <span className="font-mono text-[12px] text-ink-700">
          {r.check_out ? formatTime(r.check_out) : "—"}
        </span>
      ),
    },
    {
      key: "working_time",
      header: "Active Working",
      render: (r) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          <Clock className="h-3 w-3" />
          {r.working_duration || (r.working_hours ? `${r.working_hours}h` : "0m")}
        </span>
      ),
    },
    {
      key: "break_time",
      header: "Break Duration",
      render: (r) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          <Coffee className="h-3 w-3" />
          {r.break_duration || "0m"}
        </span>
      ),
    },
    {
      key: "exits",
      header: "Office Exits",
      render: (r) => (
        <span className="inline-flex items-center justify-center rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
          {r.exit_count ?? 0}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge value={r.status} labels={ATTENDANCE_STATUS_LABELS} />
          {r.is_flagged && (
            <span
              title={r.flag_reason || "Flagged for review"}
              className="inline-flex items-center text-rose-600"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-20 text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Eye className="h-3.5 w-3.5" />}
            onClick={() => openStaffTimeline(r.user_id, r.work_date)}
          >
            Timeline
          </Button>
        </div>
      ),
    },
  ];

  const adminTabsList = [
    { key: "today", label: "My Attendance" },
    { key: "live_board", label: "Live Team Board" },
    { key: "timeline", label: "Employee Timeline" },
    { key: "register", label: "Attendance History" },
    {
      key: "flagged",
      label: "Missing & Flagged",
      count: summary?.flagged_count || 0,
    },
  ];

  const staffTabsList = [
    { key: "today", label: "Today's Attendance" },
    { key: "register", label: "My Attendance History" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance & Break Management"
        description="Multi-event attendance tracking. Record multiple office exits for client visits, breaks and meetings with automatic duration calculations."
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="attendance" label="Attendance Guide" />
            <a href="/api/attendance/export" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
                Export CSV
              </Button>
            </a>
            {isAdmin && (
              <Button
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setManualAddOpen(true)}
              >
                Add Authorized Entry
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <Tabs
        items={isAdmin ? adminTabsList : staffTabsList}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* =========================================================================
          TAB 1: TODAY'S ATTENDANCE (STAFF HERO VIEW)
         ========================================================================= */}
      {activeTab === "today" && (
        <div className="space-y-6">
          {/* Hero Live Status Card */}
          <Card className="overflow-hidden border-brand-200/80 bg-gradient-to-r from-white via-brand-50/20 to-purple-50/30">
            <div className="p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                      todayStatus?.is_checked_in
                        ? "bg-emerald-500 text-white"
                        : todayStatus?.current_status === "checked_out"
                        ? "bg-amber-500 text-white"
                        : "bg-ink-200 text-ink-600"
                    }`}
                  >
                    {todayStatus?.is_checked_in ? (
                      <LogIn className="h-7 w-7" />
                    ) : (
                      <Coffee className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-400">
                        Today's Attendance Status
                      </span>
                      <span className="text-xs text-ink-400">·</span>
                      <span className="text-xs font-semibold text-brand-700">
                        {new Intl.DateTimeFormat("en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }).format(new Date())}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold tracking-tight text-ink-900">
                        {todayStatus?.is_checked_in
                          ? "Currently in Office (Checked In)"
                          : todayStatus?.current_status === "checked_out"
                          ? "Currently on Break (Checked Out)"
                          : "Not Checked In Today"}
                      </h2>
                      <Badge
                        tone={
                          todayStatus?.is_checked_in
                            ? "green"
                            : todayStatus?.current_status === "checked_out"
                            ? "amber"
                            : "grey"
                        }
                        dot
                      >
                        {todayStatus?.is_checked_in
                          ? `Session #${todayStatus.active_session?.session_number || 1} Active`
                          : todayStatus?.current_status === "checked_out"
                          ? "Out of Office"
                          : "Shift Not Started"}
                      </Badge>
                    </div>

                    <p className="mt-1 text-xs text-ink-500">
                      {todayStatus?.is_checked_in
                        ? `Checked in at ${formatTime(
                            todayStatus.active_session?.check_in
                          )} · Log an exit whenever leaving the office.`
                        : todayStatus?.current_status === "checked_out"
                        ? `Last exit reason: "${
                            todayStatus.sessions[todayStatus.sessions.length - 1]?.check_out_reason ||
                            "Break"
                          }" at ${formatTime(todayStatus.latest_check_out)}.`
                        : "Start your day by recording your initial check-in."}
                    </p>
                  </div>
                </div>

                {/* Primary Dual Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    disabled={Boolean(todayStatus?.is_checked_in)}
                    loading={actionBusy}
                    leftIcon={<LogIn className="h-5 w-5" />}
                    onClick={() => setCheckInOpen(true)}
                  >
                    Check In
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    disabled={!todayStatus?.is_checked_in}
                    loading={actionBusy}
                    leftIcon={<LogOut className="h-5 w-5" />}
                    onClick={() => {
                      setCheckOutReason("Lunch Break");
                      setCheckOutNote("");
                      setCheckOutOpen(true);
                    }}
                  >
                    Check Out (Leave Office)
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 divide-x divide-line border-t border-brand-100/80 bg-white/60 sm:grid-cols-4">
              <div className="px-5 py-3">
                <span className="text-[11px] font-medium text-ink-400">First In / Latest In</span>
                <p className="mt-0.5 text-sm font-bold text-ink-900">
                  {todayStatus?.first_check_in ? formatTime(todayStatus.first_check_in) : "—"}
                  {todayStatus?.latest_check_in &&
                  todayStatus.latest_check_in !== todayStatus.first_check_in
                    ? ` / ${formatTime(todayStatus.latest_check_in)}`
                    : ""}
                </p>
              </div>

              <div className="px-5 py-3">
                <span className="text-[11px] font-medium text-ink-400">Active Working Time</span>
                <p className="mt-0.5 text-sm font-bold text-emerald-700">
                  {todayStatus?.working_duration || "0m"}
                </p>
              </div>

              <div className="px-5 py-3">
                <span className="text-[11px] font-medium text-ink-400">Total Break Duration</span>
                <p className="mt-0.5 text-sm font-bold text-amber-700">
                  {todayStatus?.break_duration || "0m"}
                </p>
              </div>

              <div className="px-5 py-3">
                <span className="text-[11px] font-medium text-ink-400">Office Exits & Sessions</span>
                <p className="mt-0.5 text-sm font-bold text-brand-700">
                  {todayStatus?.exit_count || 0} exit{todayStatus?.exit_count === 1 ? "" : "s"} ·{" "}
                  {todayStatus?.completed_sessions_count || 0} completed
                </p>
              </div>
            </div>
          </Card>

          {/* Today's Live Attendance Timeline */}
          <Card>
            <CardHeader
              title="Today's Attendance Timeline"
              subtitle="Chronological log of all check-in and check-out events recorded today."
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={loadTodayStatus}
                >
                  Refresh
                </Button>
              }
            />
            <CardBody className="p-6">
              {!todayStatus || todayStatus.sessions.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No attendance events today"
                  description="Click Check In above to begin tracking your work day."
                />
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-brand-200">
                  {todayStatus.sessions.map((session, idx) => {
                    const isActive = session.status === "active" && !session.check_out;
                    return (
                      <div key={session.id} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white ${
                            isActive
                              ? "border-emerald-500 text-emerald-600 ring-4 ring-emerald-100"
                              : "border-brand-500 text-brand-600"
                          }`}
                        >
                          <div
                            className={`h-2 w-2 rounded-full ${
                              isActive ? "bg-emerald-500 animate-pulse" : "bg-brand-500"
                            }`}
                          />
                        </div>

                        {/* Session Card */}
                        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-card">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink-900 text-[13px]">
                                Session #{session.session_number}
                              </span>
                              {isActive ? (
                                <Badge tone="green" dot>
                                  Currently Working
                                </Badge>
                              ) : (
                                <Badge tone="grey">Completed</Badge>
                              )}
                              {session.is_manual && (
                                <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                  <ShieldCheck className="h-3 w-3" /> Admin Authorized
                                </span>
                              )}
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-semibold text-emerald-700">
                                {session.working_duration ? `Duration: ${session.working_duration}` : "In Progress"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {/* Check In Info */}
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                <LogIn className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-[11px] font-medium text-ink-400">Check In</span>
                                <p className="text-[12.5px] font-bold text-ink-900">
                                  {session.check_in ? formatTime(session.check_in) : "—"}
                                </p>
                                {session.check_in_note && (
                                  <p className="mt-0.5 text-[11px] text-ink-500 italic">
                                    "{session.check_in_note}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Check Out Info */}
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                <LogOut className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-[11px] font-medium text-ink-400">
                                  Check Out {session.check_out_reason ? `(${session.check_out_reason})` : ""}
                                </span>
                                <p className="text-[12.5px] font-bold text-ink-900">
                                  {session.check_out ? formatTime(session.check_out) : "Open / Ongoing"}
                                </p>
                                {session.check_out_note && (
                                  <p className="mt-0.5 text-[11px] text-ink-500 italic">
                                    "{session.check_out_note}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Break interval notice before this session */}
                          {session.break_seconds && session.break_seconds > 0 ? (
                            <div className="mt-2.5 rounded-lg bg-amber-50/60 px-3 py-1 text-[11px] text-amber-800 flex items-center gap-1.5">
                              <Coffee className="h-3.5 w-3.5 text-amber-600" />
                              <span>
                                Preceding Break Duration: <strong>{session.break_duration}</strong> before this check-in.
                              </span>
                            </div>
                          ) : null}

                          {session.correction_reason && (
                            <div className="mt-2 rounded-lg bg-purple-50/60 px-3 py-1 text-[11px] text-purple-800">
                              Reason: {session.correction_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIVE TEAM BOARD (ADMIN ONLY)
         ========================================================================= */}
      {activeTab === "live_board" && isAdmin && (
        <div className="space-y-6">
          {/* Live Overview Counters */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Currently in Office"
              value={summary?.currently_working ?? 0}
              icon={Briefcase}
              tone="green"
              footnote="Active employees working right now"
            />
            <StatCard
              label="Currently on Break"
              value={summary?.currently_on_break ?? 0}
              icon={Coffee}
              tone="amber"
              footnote="Exited office for lunch, visits, or breaks"
            />
            <StatCard
              label="Total Present Today"
              value={summary?.present ?? 0}
              icon={UserCheck}
              tone="purple"
              footnote={`Out of ${summary?.total_staff ?? 0} total active staff`}
            />
            <StatCard
              label="Missing Check-Outs / Flagged"
              value={summary?.flagged_count ?? 0}
              icon={AlertTriangle}
              tone="red"
              footnote="Sessions requiring review"
            />
          </div>

          {/* Team Live Status Cards */}
          <Card>
            <CardHeader
              title="Team Live Board"
              subtitle="Real-time workplace occupancy and current break status for all staff."
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={loadSummary}
                >
                  Refresh Live Status
                </Button>
              }
            />
            <div className="divide-y divide-line">
              {(!summary?.live_board || summary.live_board.length === 0) ? (
                <EmptyState
                  icon={Users}
                  title="No staff records found"
                  description="Active staff members will appear here."
                />
              ) : (
                summary.live_board.map((item) => (
                  <div
                    key={item.staff.id}
                    className="flex flex-col gap-4 p-5 transition-colors hover:bg-canvas sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <Avatar name={item.staff.name} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-ink-900 leading-tight">
                            {item.staff.name}
                          </p>
                          <Badge
                            tone={
                              item.live_status === "working"
                                ? "green"
                                : item.live_status === "on_break"
                                ? "amber"
                                : "grey"
                            }
                            dot
                          >
                            {item.live_status === "working"
                              ? "In Office (Working)"
                              : item.live_status === "on_break"
                              ? `On Break: ${item.last_reason || "Out"}`
                              : "Not Checked In"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-ink-400 mt-0.5">
                          {item.staff.staff_code || ""} · {item.staff.designation || item.staff.department || "Staff"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-xs text-ink-600">
                      <div>
                        <span className="text-[10.5px] text-ink-400 block">First In</span>
                        <span className="font-mono font-medium text-ink-900">
                          {item.first_check_in ? formatTime(item.first_check_in) : "—"}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10.5px] text-ink-400 block">Active Work</span>
                        <span className="font-semibold text-emerald-700">
                          {item.working_duration}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10.5px] text-ink-400 block">Break Time</span>
                        <span className="font-semibold text-amber-700">
                          {item.break_duration}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10.5px] text-ink-400 block">Exits</span>
                        <span className="font-medium text-ink-900">
                          {item.exit_count} exit{item.exit_count === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => openStaffTimeline(item.staff.id, summary.date)}
                      >
                        View Timeline
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 3: EMPLOYEE DAILY TIMELINE VIEWER (ADMIN & DETAILED INSPECTION)
         ========================================================================= */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          {/* Selector Bar */}
          <Card>
            <CardBody className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  {isAdmin && (
                    <div className="w-56">
                      <label className="block text-[11px] font-medium text-ink-400 mb-1">
                        Select Staff Member
                      </label>
                      <Select
                        value={timelineStaffId}
                        onChange={(e) => setTimelineStaffId(Number(e.target.value))}
                      >
                        {meta?.staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.staff_code || s.role})
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div className="w-44">
                    <label className="block text-[11px] font-medium text-ink-400 mb-1">
                      Inspection Date
                    </label>
                    <Input
                      type="date"
                      value={timelineDate}
                      onChange={(e) => setTimelineDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={() => loadTimeline(timelineStaffId, timelineDate)}
                    loading={timelineLoading}
                  >
                    Load Timeline
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Timeline Summary Metrics */}
          {timelineData && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total Working Time"
                value={timelineData.working_duration}
                icon={Briefcase}
                tone="green"
              />
              <StatCard
                label="Total Break Duration"
                value={timelineData.break_duration}
                icon={Coffee}
                tone="amber"
              />
              <StatCard
                label="Office Exits"
                value={timelineData.exit_count}
                icon={LogOut}
                tone="teal"
              />
              <StatCard
                label="Recorded Sessions"
                value={timelineData.sessions.length}
                icon={Layers}
                tone="purple"
              />
            </div>
          )}

          {/* Detailed Sessions List */}
          <Card>
            <CardHeader
              title={`Timeline for ${timelineData?.staff?.name || "Staff"} on ${formatDate(
                timelineDate
              )}`}
              subtitle="All attendance sessions, departure reasons and time outside work."
            />
            <CardBody className="p-6">
              {!timelineData || timelineData.sessions.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No sessions found"
                  description="No attendance sessions were recorded for this staff member on this date."
                />
              ) : (
                <div className="space-y-4">
                  {timelineData.sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink-900 text-sm">
                            Session #{sess.session_number}
                          </span>
                          <Badge
                            tone={
                              sess.status === "completed"
                                ? "green"
                                : sess.status === "active"
                                ? "blue"
                                : "red"
                            }
                          >
                            {sess.status === "completed"
                              ? "Completed"
                              : sess.status === "active"
                              ? "Active / Ongoing"
                              : "Missing Check-Out"}
                          </Badge>
                          {sess.is_manual && (
                            <Badge tone="purple">Admin Modified</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-emerald-700">
                            Work: {sess.working_duration || "Ongoing"}
                          </span>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<Pencil className="h-3 w-3" />}
                              onClick={() => {
                                setEditingSession(sess);
                                setEditSessionForm({
                                  check_in: toDateTimeInput(sess.check_in),
                                  check_out: toDateTimeInput(sess.check_out),
                                  check_out_reason: sess.check_out_reason || "Lunch Break",
                                  check_out_note: sess.check_out_note || "",
                                  check_in_note: sess.check_in_note || "",
                                  correction_reason: "",
                                });
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                        <div>
                          <span className="text-[10.5px] text-ink-400 block">Check In Time</span>
                          <span className="font-mono font-semibold text-ink-900">
                            {sess.check_in ? formatTime(sess.check_in) : "—"}
                          </span>
                          {sess.check_in_note && (
                            <p className="mt-0.5 text-ink-500 italic">"{sess.check_in_note}"</p>
                          )}
                        </div>

                        <div>
                          <span className="text-[10.5px] text-ink-400 block">Check Out Time</span>
                          <span className="font-mono font-semibold text-ink-900">
                            {sess.check_out ? formatTime(sess.check_out) : "Open"}
                          </span>
                          {sess.check_out_note && (
                            <p className="mt-0.5 text-ink-500 italic">"{sess.check_out_note}"</p>
                          )}
                        </div>

                        <div>
                          <span className="text-[10.5px] text-ink-400 block">Reason for Departure</span>
                          <span className="font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md inline-block">
                            {sess.check_out_reason || "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10.5px] text-ink-400 block">Break Before Session</span>
                          <span className="font-semibold text-amber-700">
                            {sess.break_duration || "0m"}
                          </span>
                        </div>
                      </div>

                      {sess.correction_reason && (
                        <div className="mt-3 rounded-md bg-purple-50/70 p-2 text-[11px] text-purple-900">
                          <strong>Admin Correction Note:</strong> {sess.correction_reason}{" "}
                          {sess.corrected_by ? `(by ${sess.corrected_by.name})` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ATTENDANCE HISTORY / REGISTER
         ========================================================================= */}
      {activeTab === "register" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <Card>
            <CardBody className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-36">
                  <label className="block text-[11px] font-medium text-ink-400 mb-1">From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                <div className="w-36">
                  <label className="block text-[11px] font-medium text-ink-400 mb-1">To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                {isAdmin && (
                  <div className="w-48">
                    <label className="block text-[11px] font-medium text-ink-400 mb-1">Staff Member</label>
                    <Select
                      value={staffFilter}
                      onChange={(e) => {
                        setStaffFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Staff Members</option>
                      {meta?.staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="w-36">
                  <label className="block text-[11px] font-medium text-ink-400 mb-1">Status</label>
                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="present">Present</option>
                    <option value="half_day">Half Day</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                  </Select>
                </div>

                {isAdmin && (
                  <div className="w-36">
                    <label className="block text-[11px] font-medium text-ink-400 mb-1">Review</label>
                    <Select
                      value={flagFilter}
                      onChange={(e) => {
                        setFlagFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All Records</option>
                      <option value="true">Flagged Only</option>
                    </Select>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Table */}
          <Card>
            <DataTable
              columns={registerColumns}
              rows={data?.items ?? []}
              rowKey={(r) => r.id}
              loading={loading}
              emptyTitle="No attendance records"
              emptyDescription="No attendance data matches the selected criteria."
            />
            {data && data.pages > 1 && (
              <Pagination
                page={page}
                pages={data.pages}
                total={data.total}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            )}
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 5: MISSING CHECK-OUTS & FLAGGED SESSIONS (ADMIN)
         ========================================================================= */}
      {activeTab === "flagged" && isAdmin && (
        <Card>
          <CardHeader
            title="Missing Check-Outs & Flagged Sessions"
            subtitle="Staff members who forgot to check out or sessions requiring administrative resolution."
            action={
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={loadFlagged}
              >
                Refresh Queue
              </Button>
            }
          />
          <CardBody className="p-6">
            {flaggedSessions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All clear! No flagged sessions"
                description="All employees have properly recorded check-outs without discrepancies."
              />
            ) : (
              <div className="space-y-4">
                {flaggedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-4 rounded-xl border border-rose-200 bg-rose-50/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-ink-900">
                            {session.user_id ? `Employee #${session.user_id}` : "Staff Member"} ·{" "}
                            {formatDate(session.work_date)}
                          </p>
                          <Badge tone="red">Missing Check-Out</Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-600">
                          Checked in for Session #{session.session_number} at{" "}
                          <strong>{formatTime(session.check_in)}</strong> without recording departure.
                        </p>
                      </div>
                    </div>

                    <div>
                      <Button
                        size="sm"
                        variant="primary"
                        leftIcon={<Check className="h-3.5 w-3.5" />}
                        onClick={() => {
                          setResolvingSession(session);
                          setResolveForm({
                            check_out: `${session.work_date}T18:00`,
                            check_out_reason: "End of Day",
                            check_out_note: "Resolved by administrator",
                            resolution_reason: "",
                          });
                        }}
                      >
                        Resolve Check-Out
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* 1. Check-Out Reason Modal */}
      <Modal
        open={checkOutOpen}
        onClose={() => setCheckOutOpen(false)}
        title="Record Office Exit / Check-Out"
        description="Please specify the reason for leaving the office. Your return will be recorded upon next check-in."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCheckOutOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckOut}
              loading={actionBusy}
              leftIcon={<LogOut className="h-4 w-4" />}
            >
              Confirm Check-Out
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Reason for Leaving Office" required>
            <Select
              value={checkOutReason}
              onChange={(e) => setCheckOutReason(e.target.value)}
            >
              {DEFAULT_CHECK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Optional Note / Details">
            <Textarea
              rows={2}
              value={checkOutNote}
              onChange={(e) => setCheckOutNote(e.target.value)}
              placeholder="e.g. Client visit at ABC Corp, lunch with team, etc."
            />
          </Field>
        </div>
      </Modal>

      {/* 2. Check-In Note Modal */}
      <Modal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        title="Check In to Office"
        description="Confirm your return / arrival at the office. Working time calculation will resume immediately."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCheckInOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckIn}
              loading={actionBusy}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              Confirm Check In
            </Button>
          </div>
        }
      >
        <Field label="Optional Note on Arrival">
          <Input
            value={checkInNote}
            onChange={(e) => setCheckInNote(e.target.value)}
            placeholder="e.g. Returned from client meeting, morning start..."
          />
        </Field>
      </Modal>

      {/* 3. Resolve Missing Check-Out Modal (Admin) */}
      <Modal
        open={Boolean(resolvingSession)}
        onClose={() => setResolvingSession(null)}
        title="Resolve Missing Check-Out"
        description="Assign authorized departure time and provide mandatory audit justification."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResolvingSession(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolveFlag} loading={saving}>
              Save Resolution
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Authorized Check-Out Date & Time" required>
            <Input
              type="datetime-local"
              value={resolveForm.check_out}
              onChange={(e) => setResolveForm({ ...resolveForm, check_out: e.target.value })}
            />
          </Field>

          <Field label="Departure Reason" required>
            <Select
              value={resolveForm.check_out_reason}
              onChange={(e) => setResolveForm({ ...resolveForm, check_out_reason: e.target.value })}
            >
              {DEFAULT_CHECK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Resolution / Audit Reason" required>
            <Textarea
              rows={2}
              value={resolveForm.resolution_reason}
              onChange={(e) => setResolveForm({ ...resolveForm, resolution_reason: e.target.value })}
              placeholder="Mandatory justification for compliance audit (e.g. Verified with employee - left at 6 PM)..."
            />
          </Field>
        </div>
      </Modal>

      {/* 4. Admin Manual Session Entry */}
      <Modal
        open={manualAddOpen}
        onClose={() => setManualAddOpen(false)}
        title="Add Authorized Attendance Session"
        description="Insert an authorized attendance event. Mandatory compliance justification is logged in audit trails."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setManualAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualAdd} loading={saving}>
              Add Session
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Staff Member" required>
            <Select
              value={manualAddForm.user_id}
              onChange={(e) => setManualAddForm({ ...manualAddForm, user_id: e.target.value })}
            >
              <option value="">Select Employee</option>
              {meta?.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.staff_code || s.role})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" required>
            <Input
              type="date"
              value={manualAddForm.work_date}
              onChange={(e) => setManualAddForm({ ...manualAddForm, work_date: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Check In Time" required>
              <Input
                type="datetime-local"
                value={manualAddForm.check_in}
                onChange={(e) => setManualAddForm({ ...manualAddForm, check_in: e.target.value })}
              />
            </Field>

            <Field label="Check Out Time">
              <Input
                type="datetime-local"
                value={manualAddForm.check_out}
                onChange={(e) => setManualAddForm({ ...manualAddForm, check_out: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Exit Reason">
            <Select
              value={manualAddForm.check_out_reason}
              onChange={(e) => setManualAddForm({ ...manualAddForm, check_out_reason: e.target.value })}
            >
              {DEFAULT_CHECK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Mandatory Reason for Manual Entry" required>
            <Textarea
              rows={2}
              value={manualAddForm.correction_reason}
              onChange={(e) => setManualAddForm({ ...manualAddForm, correction_reason: e.target.value })}
              placeholder="e.g. Employee visited on-site client for full morning shift..."
            />
          </Field>
        </div>
      </Modal>

      {/* 5. Admin Edit Session Modal */}
      <Modal
        open={Boolean(editingSession)}
        onClose={() => setEditingSession(null)}
        title={`Edit Session #${editingSession?.session_number}`}
        description="Correct recorded timestamps. Mandatory reason will be permanently archived in compliance audit logs."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingSession(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSession} loading={saving}>
              Save Corrections
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check In Timestamp">
              <Input
                type="datetime-local"
                value={editSessionForm.check_in}
                onChange={(e) => setEditSessionForm({ ...editSessionForm, check_in: e.target.value })}
              />
            </Field>

            <Field label="Check Out Timestamp">
              <Input
                type="datetime-local"
                value={editSessionForm.check_out}
                onChange={(e) => setEditSessionForm({ ...editSessionForm, check_out: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Exit Reason">
            <Select
              value={editSessionForm.check_out_reason}
              onChange={(e) =>
                setEditSessionForm({ ...editSessionForm, check_out_reason: e.target.value })
              }
            >
              {DEFAULT_CHECK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Mandatory Correction Reason" required>
            <Textarea
              rows={2}
              value={editSessionForm.correction_reason}
              onChange={(e) =>
                setEditSessionForm({ ...editSessionForm, correction_reason: e.target.value })
              }
              placeholder="Reason for timestamp adjustments..."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ActionMenu } from "../components/ui/ActionMenu";
import { Avatar } from "../components/ui/Avatar";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Column, DataTable, Pagination } from "../components/ui/DataTable";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../components/ui/Input";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { PageHeader } from "../components/ui/PageHeader";
import { Tabs } from "../components/ui/Tabs";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  FOLLOWUP_STATUS_LABELS,
  METHOD_LABELS,
  cn,
  formatDate,
  formatShortDate,
  formatTime,
  labelFor,
  monthTitle,
  toDateInput,
  toDateTimeInput,
} from "../lib/format";
import type { FollowUp, Lead, Paginated } from "../lib/types";

const PAGE_SIZE = 10;

type FollowUpPage = Paginated<FollowUp> & {
  counts: Record<string, number>;
};

interface FollowUpFormState {
  lead_id: string;
  due_at: string;
  method: string;
  notes: string;
  staff_id: string;
}

const EMPTY_FORM: FollowUpFormState = {
  lead_id: "",
  due_at: toDateTimeInput(new Date().toISOString()),
  method: "call",
  notes: "",
  staff_id: "",
};

function FollowUpCalendar({
  month,
  items,
  onMonthChange,
  onSelectDay,
  selectedDate,
}: {
  month: Date;
  items: FollowUp[];
  onMonthChange: (month: Date) => void;
  onSelectDay: (date: string) => void;
  selectedDate: string;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const leading = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = useMemo(() => {
    const map: Record<string, FollowUp[]> = {};
    items.forEach((item) => {
      const key = item.due_at.slice(0, 10);
      map[key] = [...(map[key] ?? []), item];
    });
    return map;
  }, [items]);

  const today = toDateInput();

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3">
        <p className="text-[13px] font-semibold text-ink-900">{monthTitle(month)}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
            className="rounded-lg border border-line p-1.5 text-ink-500 transition-colors hover:bg-canvas"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(year, monthIndex, 1))}
            className="rounded-lg border border-line px-2 py-1.5 text-[10.5px] font-medium text-ink-600 transition-colors hover:bg-canvas"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
            className="rounded-lg border border-line p-1.5 text-ink-500 transition-colors hover:bg-canvas"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-y border-line bg-[#fbf9ff]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-400"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`blank-${index}`} className="min-h-[88px] border-b border-r border-line bg-[#fdfcff]" />;
          }
          const dateValue = toDateInput(new Date(year, monthIndex, day));
          const followUps = byDay[dateValue] ?? [];
          return (
            <button
              key={dateValue}
              type="button"
              onClick={() => onSelectDay(dateValue)}
              className={cn(
                "min-h-[88px] border-b border-r border-line p-1.5 text-left align-top transition-colors hover:bg-brand-50/40",
                selectedDate === dateValue && "bg-brand-50/70 ring-1 ring-inset ring-brand-300"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-medium",
                    dateValue === today
                      ? "bg-brand-600 text-white"
                      : "text-ink-500"
                  )}
                >
                  {day}
                </span>
                {followUps.length > 0 ? (
                  <span className="text-[9px] font-semibold text-brand-600">{followUps.length}</span>
                ) : null}
              </div>
              <div className="space-y-0.5">
                {followUps.slice(0, 2).map((followUp) => (
                  <div
                    key={followUp.id}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[9px] font-medium",
                      followUp.status === "overdue"
                        ? "bg-rose-50 text-rose-700"
                        : followUp.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-brand-100/60 text-brand-800"
                    )}
                  >
                    {formatTime(followUp.due_at)} · {followUp.business_name}
                  </div>
                ))}
                {followUps.length > 2 ? (
                  <p className="px-1 text-[8.5px] text-ink-400">+{followUps.length - 2} more</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FollowUps() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();

  const [view, setView] = useState("today");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [staffId, setStaffId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<"table" | "calendar">("table");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [data, setData] = useState<FollowUpPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarItems, setCalendarItems] = useState<FollowUp[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [form, setForm] = useState<FollowUpFormState>(EMPTY_FORM);
  const [leadOptions, setLeadOptions] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<FollowUp | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.get<FollowUpPage>("/followups", {
        view,
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
        method: method === "all" ? undefined : method,
        staff_id: staffId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load follow-ups", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [view, page, debouncedSearch, method, staffId, dateFrom, dateTo, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCalendar = useCallback(async () => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    setCalendarLoading(true);
    try {
      const payload = await api.get<FollowUpPage>("/followups", {
        view: "all",
        page_size: 100,
        date_from: toDateInput(start),
        date_to: toDateInput(end),
        staff_id: staffId || undefined,
      });
      setCalendarItems(payload.items);
    } catch (err) {
      toast.error("Could not load calendar", err instanceof Error ? err.message : undefined);
    } finally {
      setCalendarLoading(false);
    }
  }, [month, staffId, toast]);

  useEffect(() => {
    if (layout === "calendar") void loadCalendar();
  }, [layout, loadCalendar]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      due_at: toDateTimeInput(new Date().toISOString()),
      staff_id: user?.role === "staff" ? String(user.id) : "",
    });
    setErrors({});
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen || editing) return;
    let active = true;
    api
      .get<Paginated<Lead>>("/leads", { page_size: 100, sort: "business" })
      .then((payload) => {
        if (active) setLeadOptions(payload.items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [modalOpen, editing]);

  const openEdit = (followUp: FollowUp) => {
    setEditing(followUp);
    setForm({
      lead_id: String(followUp.lead_id),
      due_at: toDateTimeInput(followUp.due_at),
      method: followUp.method,
      notes: followUp.notes ?? "",
      staff_id: followUp.staff_id ? String(followUp.staff_id) : "",
    });
    setErrors({});
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!editing && !form.lead_id) next.lead_id = "Select a lead.";
    if (!form.due_at) next.due_at = "Choose a date and time.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch<FollowUp>(`/followups/${editing.id}`, {
          due_at: form.due_at,
          method: form.method,
          notes: form.notes.trim() || null,
          staff_id: form.staff_id ? Number(form.staff_id) : null,
        });
        toast.success("Follow-up updated", editing.code);
      } else {
        await api.post<FollowUp>("/followups", {
          lead_id: Number(form.lead_id),
          due_at: form.due_at,
          method: form.method,
          notes: form.notes.trim() || null,
          staff_id: form.staff_id ? Number(form.staff_id) : null,
        });
        toast.success("Follow-up scheduled", "Added to the follow-up list.");
      }
      setModalOpen(false);
      void load();
      if (layout === "calendar") void loadCalendar();
    } catch (err) {
      toast.error("Could not save follow-up", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (followUp: FollowUp, status: "completed" | "cancelled") => {
    try {
      await api.patch(`/followups/${followUp.id}`, { status });
      toast.success(
        status === "completed" ? "Follow-up completed" : "Follow-up cancelled",
        followUp.business_name ?? followUp.code
      );
      void load();
      if (layout === "calendar") void loadCalendar();
    } catch (err) {
      toast.error("Could not update follow-up", err instanceof Error ? err.message : undefined);
    }
  };

  const removeFollowUp = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/followups/${deleteTarget.id}`);
      toast.success("Follow-up deleted", deleteTarget.code);
      setDeleteTarget(null);
      void load();
      if (layout === "calendar") void loadCalendar();
    } catch (err) {
      toast.error("Could not delete follow-up", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { key: "today", label: "Today", count: data?.counts.today },
    { key: "upcoming", label: "Upcoming", count: data?.counts.upcoming },
    { key: "overdue", label: "Overdue", count: data?.counts.overdue },
    { key: "completed", label: "Completed", count: data?.counts.completed },
    { key: "all", label: "All", count: data?.counts.pending },
  ];

  const columns: Column<FollowUp>[] = [
    {
      key: "code",
      header: "Follow-up ID",
      render: (row) => (
        <span className="whitespace-nowrap text-[11px] font-medium tabular text-ink-400">
          {row.code}
        </span>
      ),
    },
    {
      key: "business",
      header: "Business name",
      render: (row) => (
        <div className="min-w-[150px]">
          <p className="text-[12.5px] font-semibold text-ink-900">{row.business_name}</p>
          <p className="mt-0.5 text-[10px] text-ink-400">{row.lead_code}</p>
        </div>
      ),
    },
    {
      key: "staff",
      header: "Assigned staff",
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={row.staff?.name} size="xs" />
          <span className="text-[11.5px] text-ink-600">{row.staff?.name ?? "Unassigned"}</span>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] text-ink-600">
          {formatDate(row.due_at)}
        </span>
      ),
    },
    {
      key: "time",
      header: "Time",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] tabular text-ink-600">
          {formatTime(row.due_at)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Contact method",
      render: (row) => <Badge tone="grey">{labelFor(METHOD_LABELS, row.method)}</Badge>,
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (
        <p className="line-clamp-2 max-w-[190px] text-[11px] leading-relaxed text-ink-500">
          {row.notes ?? "—"}
        </p>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} labels={FOLLOWUP_STATUS_LABELS} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <ActionMenu
          actions={[
            {
              label: "Mark completed",
              icon: Check,
              onClick: () => void updateStatus(row, "completed"),
              hidden: row.stored_status !== "pending",
            },
            {
              label: "Reschedule",
              icon: Pencil,
              onClick: () => openEdit(row),
              hidden: row.stored_status !== "pending",
            },
            {
              label: "Cancel follow-up",
              icon: X,
              onClick: () => void updateStatus(row, "cancelled"),
              hidden: row.stored_status !== "pending",
            },
            {
              label: "Delete",
              icon: Trash2,
              danger: true,
              onClick: () => setDeleteTarget(row),
              hidden: user?.role !== "admin",
            },
          ]}
        />
      ),
    },
  ];

  const hasDateFilter = Boolean(dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description="Keep the next conversation visible. Overdue items are flagged automatically, and completed follow-ups stay in the history."
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="followups" label="Follow-up Guide" />
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
              Schedule follow-up
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={tabs}
          value={view}
          onChange={(value) => {
            setView(value);
            setPage(1);
          }}
        />
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
          <button
            type="button"
            onClick={() => setLayout("table")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              layout === "table" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-800"
            )}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setLayout("calendar")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              layout === "calendar" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-800"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </button>
        </div>
      </div>

      <Card className="mb-4">
        <CardBody className="py-3.5">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Search" className="min-w-[190px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Business, lead ID or phone"
              />
            </Field>
            <Field label="Contact method" className="w-[150px]">
              <Select
                value={method}
                onChange={(event) => {
                  setMethod(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All methods</option>
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {user?.role === "admin" ? (
              <Field label="Staff" className="w-[150px]">
                <Select
                  value={staffId}
                  onChange={(event) => {
                    setStaffId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All staff</option>
                  {(meta?.staff ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="From" className="w-[140px]">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
              />
            </Field>
            <Field label="To" className="w-[140px]">
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
              />
            </Field>
            {hasDateFilter ? (
              <Button
                variant="ghost"
                size="sm"
                className="mb-0.5"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
              >
                Clear dates
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {layout === "calendar" ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="Follow-up calendar"
            subtitle={
              hasDateFilter
                ? `Filtered to ${formatDate(dateFrom)} – ${formatDate(dateTo)}`
                : "Click a day to filter the list below"
            }
            action={<Badge tone="purple">{calendarItems.length} in view</Badge>}
          />
          {calendarLoading ? (
            <div className="flex h-[420px] items-center justify-center text-xs text-ink-400">
              Loading calendar…
            </div>
          ) : (
            <FollowUpCalendar
              month={month}
              items={calendarItems}
              onMonthChange={setMonth}
              selectedDate={dateFrom && dateFrom === dateTo ? dateFrom : ""}
              onSelectDay={(value) => {
                setDateFrom(value);
                setDateTo(value);
                setView("all");
                setPage(1);
              }}
            />
          )}
        </Card>
      ) : null}

      <Card className={layout === "calendar" ? "mt-4" : ""}>
        <CardHeader
          title={
            view === "today"
              ? "Today's follow-ups"
              : view === "upcoming"
                ? "Upcoming follow-ups"
                : view === "overdue"
                  ? "Overdue follow-ups"
                  : view === "completed"
                    ? "Completed follow-ups"
                    : "All follow-ups"
          }
          subtitle="Pending items become overdue automatically after their due time"
          action={<Badge tone={view === "overdue" ? "red" : "purple"}>{data?.total ?? 0}</Badge>}
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          minWidth="1120px"
          emptyIcon={Clock}
          emptyTitle="No follow-ups in this view"
          emptyDescription={
            view === "overdue"
              ? "Nothing is overdue — every scheduled follow-up is on track."
              : "Schedule a follow-up to make sure the next conversation is not missed."
          }
          emptyAction={
            view !== "completed" ? (
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
                Schedule follow-up
              </Button>
            ) : undefined
          }
        />
        <Pagination
          page={data?.page ?? 1}
          pages={data?.pages ?? 0}
          total={data?.total ?? 0}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Reschedule follow-up" : "Schedule a follow-up"}
        description={
          editing
            ? `${editing.code} · ${editing.business_name ?? ""}`
            : "Choose the lead, contact method and due time."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="followup-form" loading={saving}>
              {editing ? "Save changes" : "Schedule follow-up"}
            </Button>
          </>
        }
      >
        <form id="followup-form" onSubmit={submit} className="space-y-4" noValidate>
          {!editing ? (
            <Field label="Lead / business" required error={errors.lead_id}>
              <Select
                value={form.lead_id}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, lead_id: event.target.value }));
                  setErrors((prev) => ({ ...prev, lead_id: "" }));
                }}
                invalid={Boolean(errors.lead_id)}
              >
                <option value="">Select a lead</option>
                {leadOptions.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.business_name} · {lead.code}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Date & time" required error={errors.due_at}>
              <Input
                type="datetime-local"
                value={form.due_at}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, due_at: event.target.value }));
                  setErrors((prev) => ({ ...prev, due_at: "" }));
                }}
                invalid={Boolean(errors.due_at)}
              />
            </Field>
            <Field label="Contact method">
              <Select
                value={form.method}
                onChange={(event) => setForm((prev) => ({ ...prev, method: event.target.value }))}
              >
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {user?.role === "admin" ? (
              <Field label="Assigned staff" className="sm:col-span-2">
                <Select
                  value={form.staff_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, staff_id: event.target.value }))}
                >
                  <option value="">Keep lead owner</option>
                  {(meta?.staff ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="What needs to happen on this follow-up?"
              rows={3}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeFollowUp}
        loading={busy}
        title="Delete this follow-up?"
        description={`${deleteTarget?.code ?? ""} will be permanently removed from the schedule and reports.`}
        confirmLabel="Delete follow-up"
      />
    </div>
  );
}

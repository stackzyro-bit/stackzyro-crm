import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  MEETING_STATUS_LABELS,
  MEETING_TYPE_LABELS,
  formatDate,
  formatTime,
  labelFor,
  toDateTimeInput,
} from "../lib/format";
import type { Lead, Meeting, Paginated } from "../lib/types";

const PAGE_SIZE = 10;

interface MeetingFormState {
  lead_id: string;
  scheduled_at: string;
  duration_minutes: string;
  meeting_type: string;
  location: string;
  notes: string;
  staff_id: string;
  status: string;
}

const EMPTY_FORM: MeetingFormState = {
  lead_id: "",
  scheduled_at: "",
  duration_minutes: "30",
  meeting_type: "google_meet",
  location: "",
  notes: "",
  staff_id: "",
  status: "scheduled",
};

export function Meetings() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [staffId, setStaffId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Meeting> | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState<MeetingFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.get<Paginated<Meeting>>("/meetings", {
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        staff_id: staffId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load meetings", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, staffId, dateFrom, dateTo, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modalOpen) return;
    let active = true;
    api
      .get<Paginated<Lead>>("/leads", { page_size: 100, sort: "business" })
      .then((payload) => {
        if (active) setLeads(payload.items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    if (searchParams.get("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  };

  const openCreate = () => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    start.setSeconds(0, 0);
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      scheduled_at: toDateTimeInput(start.toISOString()),
      staff_id: user?.role === "staff" ? String(user.id) : "",
    });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (meeting: Meeting) => {
    setEditing(meeting);
    setForm({
      lead_id: String(meeting.lead_id),
      scheduled_at: toDateTimeInput(meeting.scheduled_at),
      duration_minutes: String(meeting.duration_minutes),
      meeting_type: meeting.meeting_type,
      location: meeting.location ?? "",
      notes: meeting.notes ?? "",
      staff_id: meeting.staff_id ? String(meeting.staff_id) : "",
      status: meeting.status,
    });
    setErrors({});
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!editing && !form.lead_id) next.lead_id = "Select the lead for this meeting.";
    if (!form.scheduled_at) next.scheduled_at = "Choose a date and time.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const payload = {
        lead_id: form.lead_id ? Number(form.lead_id) : undefined,
        scheduled_at: form.scheduled_at,
        duration_minutes: Number(form.duration_minutes) || 30,
        meeting_type: form.meeting_type,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        staff_id: form.staff_id ? Number(form.staff_id) : null,
        status: form.status,
      };
      if (editing) {
        await api.patch<Meeting>(`/meetings/${editing.id}`, payload);
        toast.success("Meeting updated", editing.code);
      } else {
        const meeting = await api.post<Meeting>("/meetings", payload);
        toast.success("Meeting scheduled", `${meeting.code} · ${meeting.business_name}`);
      }
      closeModal();
      void load();
    } catch (err) {
      toast.error("Could not save meeting", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (meeting: Meeting, value: "completed" | "cancelled") => {
    try {
      await api.patch(`/meetings/${meeting.id}`, { status: value });
      toast.success(
        value === "completed" ? "Meeting completed" : "Meeting cancelled",
        meeting.code
      );
      void load();
    } catch (err) {
      toast.error("Could not update meeting", err instanceof Error ? err.message : undefined);
    }
  };

  const removeMeeting = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/meetings/${deleteTarget.id}`);
      toast.success("Meeting deleted", deleteTarget.code);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error("Could not delete meeting", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Meeting>[] = [
    {
      key: "code",
      header: "Meeting ID",
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
        <span className="whitespace-nowrap text-[12.5px] font-semibold text-ink-900">
          {row.business_name}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact person",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] text-ink-600">
          {row.contact_person ?? "—"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Meeting date",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] text-ink-600">
          {formatDate(row.scheduled_at)}
        </span>
      ),
    },
    {
      key: "time",
      header: "Time",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] tabular text-ink-600">
          {formatTime(row.scheduled_at)}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <Badge tone="grey">{labelFor(MEETING_TYPE_LABELS, row.meeting_type)}</Badge>,
    },
    {
      key: "location",
      header: "Link / location",
      render: (row) =>
        row.location ? (
          row.location.startsWith("http") ? (
            <a
              href={row.location}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-[180px] items-center gap-1 truncate text-[11px] font-medium text-brand-700 hover:underline"
            >
              <Video className="h-3 w-3 shrink-0" />
              Join meeting
            </a>
          ) : (
            <span className="block max-w-[190px] truncate text-[11px] text-ink-500">
              {row.location}
            </span>
          )
        ) : (
          <span className="text-[11px] text-ink-400">—</span>
        ),
    },
    {
      key: "staff",
      header: "Assigned staff",
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={row.staff?.name} size="xs" />
          <span className="text-[11.5px] text-ink-600">{row.staff?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Meeting status",
      render: (row) => <StatusBadge value={row.status} labels={MEETING_STATUS_LABELS} />,
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (
        <p className="line-clamp-2 max-w-[160px] text-[11px] text-ink-500">{row.notes ?? "—"}</p>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <ActionMenu
          actions={[
            {
              label: "Join / open link",
              icon: ExternalLink,
              onClick: () => row.location && window.open(row.location, "_blank"),
              hidden: !row.location?.startsWith("http"),
            },
            { label: "Edit meeting", icon: Pencil, onClick: () => openEdit(row) },
            {
              label: "Mark completed",
              icon: CheckCircle2,
              onClick: () => void updateStatus(row, "completed"),
              hidden: row.status === "completed" || row.status === "cancelled",
            },
            {
              label: "Cancel meeting",
              icon: XCircle,
              onClick: () => void updateStatus(row, "cancelled"),
              hidden: row.status === "completed" || row.status === "cancelled",
            },
            {
              label: "Delete meeting",
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

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Book discovery calls, demos and on-site visits, with the Google Meet link or location in one place."
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="meetings" label="Meeting Guide" />
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
              Schedule meeting
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardBody className="py-3.5">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Search" className="min-w-[200px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Business, contact or meeting ID"
              />
            </Field>
            <Field label="Status" className="w-[155px]">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                {Object.entries(MEETING_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {user?.role === "admin" ? (
              <Field label="Staff" className="w-[155px]">
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
            {search || status !== "all" || staffId || dateFrom || dateTo ? (
              <Button
                variant="ghost"
                size="sm"
                className="mb-0.5"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setStaffId("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Meeting register"
          subtitle="Scheduled, rescheduled and completed conversations"
          action={<Badge tone="purple">{data?.total ?? 0} meetings</Badge>}
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          minWidth="1280px"
          emptyIcon={CalendarDays}
          emptyTitle="No meetings scheduled"
          emptyDescription="Schedule a discovery call or demo to keep the conversation moving."
          emptyAction={
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
              Schedule meeting
            </Button>
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
        onClose={closeModal}
        size="md"
        title={editing ? `Edit ${editing.code}` : "Schedule a meeting"}
        description={
          editing
            ? "Update the time, meeting type or status."
            : "Choose the lead, meeting type and a Google Meet link or location."
        }
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="meeting-form" loading={saving}>
              {editing ? "Save changes" : "Schedule meeting"}
            </Button>
          </>
        }
      >
        <form id="meeting-form" onSubmit={submit} className="space-y-4" noValidate>
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
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.business_name} · {lead.code}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Date & time" required error={errors.scheduled_at}>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, scheduled_at: event.target.value }));
                  setErrors((prev) => ({ ...prev, scheduled_at: "" }));
                }}
                invalid={Boolean(errors.scheduled_at)}
              />
            </Field>
            <Field label="Duration (minutes)">
              <Input
                type="number"
                min="10"
                max="480"
                step="5"
                value={form.duration_minutes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, duration_minutes: event.target.value }))
                }
              />
            </Field>
            <Field label="Meeting type">
              <Select
                value={form.meeting_type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, meeting_type: event.target.value }))
                }
              >
                {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                {Object.entries(MEETING_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Google Meet link or location"
              className="sm:col-span-2"
              hint="Paste a meeting URL, or enter the office address for an on-site visit."
            >
              <Input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="https://meet.google.com/… or STACKZYRO Office"
              />
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
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Agenda, attendees or preparation notes."
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeMeeting}
        loading={busy}
        title="Delete this meeting?"
        description={`${deleteTarget?.code ?? ""} will be removed from the meeting schedule.`}
        confirmLabel="Delete meeting"
      />
    </div>
  );
}

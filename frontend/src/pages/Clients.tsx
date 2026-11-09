import { Building2, Eye, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ActionMenu } from "../components/ui/ActionMenu";
import { Avatar } from "../components/ui/Avatar";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Column, DataTable, Pagination } from "../components/ui/DataTable";
import { Modal } from "../components/ui/Modal";
import { Field, Input, Select, Textarea } from "../components/ui/Input";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  PROJECT_STATUS_LABELS,
  formatDate,
  formatDateTime,
} from "../lib/format";
import type { Client, Paginated } from "../lib/types";

const PAGE_SIZE = 10;

interface ClientFormState {
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  services: string;
  start_date: string;
  project_status: string;
  assigned_staff_id: string;
  notes: string;
}

const EMPTY_FORM: ClientFormState = {
  business_name: "",
  contact_person: "",
  phone: "",
  email: "",
  services: "",
  start_date: "",
  project_status: "in_progress",
  assigned_staff_id: "",
  notes: "",
};

export function Clients() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [staffId, setStaffId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Client> | null>(null);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<Client | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
      const payload = await api.get<Paginated<Client>>("/clients", {
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        staff_id: staffId || undefined,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load clients", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, staffId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({
      business_name: client.business_name,
      contact_person: client.contact_person ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      services: client.services ?? "",
      start_date: client.start_date ?? "",
      project_status: client.project_status,
      assigned_staff_id: client.assigned_staff_id ? String(client.assigned_staff_id) : "",
      notes: client.notes ?? "",
    });
    setErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const next: Record<string, string> = {};
    if (form.business_name.trim().length < 2) next.business_name = "Business name is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const updated = await api.patch<Client>(`/clients/${editing.id}`, {
        business_name: form.business_name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        services: form.services.trim() || null,
        start_date: form.start_date || null,
        project_status: form.project_status,
        assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
        notes: form.notes.trim() || null,
      });
      toast.success("Client updated", updated.code);
      setEditing(null);
      setDetail(updated);
      void load();
    } catch (err) {
      toast.error("Could not update client", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Client>[] = [
    {
      key: "code",
      header: "Client ID",
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
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDetail(row);
            }}
            className="text-left text-[12.5px] font-semibold text-ink-900 hover:text-brand-700"
          >
            {row.business_name}
          </button>
          <p className="mt-0.5 text-[10px] text-ink-400">From {row.lead_code ?? "—"}</p>
        </div>
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
      key: "phone",
      header: "Phone",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] tabular text-ink-600">
          {row.phone ?? "—"}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => (
        <span className="max-w-[180px] truncate text-[11.5px] text-ink-600">{row.email ?? "—"}</span>
      ),
    },
    {
      key: "services",
      header: "Services",
      render: (row) => (
        <p className="line-clamp-2 max-w-[190px] text-[11px] leading-relaxed text-ink-600">
          {row.services ?? "—"}
        </p>
      ),
    },
    {
      key: "start",
      header: "Project start",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] text-ink-600">
          {formatDate(row.start_date)}
        </span>
      ),
    },
    {
      key: "project",
      header: "Project status",
      render: (row) => <StatusBadge value={row.project_status} labels={PROJECT_STATUS_LABELS} />,
    },
    {
      key: "team",
      header: "Assigned team member",
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={row.assigned_staff?.name} size="xs" />
          <span className="text-[11.5px] text-ink-600">{row.assigned_staff?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <ActionMenu
          actions={[
            { label: "View client", icon: Eye, onClick: () => setDetail(row) },
            {
              label: "Edit client",
              icon: Pencil,
              onClick: () => openEdit(row),
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
        title="Clients"
        description="Only confirmed clients appear here. Converting a lead creates the client account automatically."
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="clients" label="Client Guide" />
            <Badge tone="teal">{data?.total ?? 0} confirmed clients</Badge>
          </div>
        }
      />

      <Card className="mb-4">
        <CardBody className="py-3.5">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Search" className="min-w-[220px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Business, contact, email or client ID"
              />
            </Field>
            <Field label="Project status" className="w-[165px]">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {user?.role === "admin" ? (
              <Field label="Team member" className="w-[170px]">
                <Select
                  value={staffId}
                  onChange={(event) => {
                    setStaffId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All members</option>
                  {(meta?.staff ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Client accounts"
          subtitle="Businesses with a confirmed engagement"
          action={<Badge tone="purple">{data?.total ?? 0} clients</Badge>}
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          minWidth="1240px"
          emptyIcon={Building2}
          emptyTitle="No confirmed clients yet"
          emptyDescription="Convert a lead from the Leads page once the business confirms. Only confirmed clients appear here."
          onRowClick={(row) => setDetail(row)}
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
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.business_name ?? "Client"}
        description={detail ? `${detail.code} · Confirmed client` : undefined}
        footer={
          detail && user?.role === "admin" ? (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => {
                const current = detail;
                setDetail(null);
                openEdit(current);
              }}
            >
              Edit client
            </Button>
          ) : undefined
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={detail.project_status} labels={PROJECT_STATUS_LABELS} />
              <Badge tone="teal">Confirmed client</Badge>
              <Badge tone="grey">Start {formatDate(detail.start_date)}</Badge>
            </div>
            <div className="grid gap-3 rounded-lg border border-line bg-[#fcfbfe] p-3.5 text-[12px] sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Contact person</p>
                <p className="mt-0.5 font-medium text-ink-800">{detail.contact_person ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Phone</p>
                <p className="mt-0.5 font-medium text-ink-800">{detail.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Email</p>
                <p className="mt-0.5 truncate font-medium text-ink-800">{detail.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Team member</p>
                <p className="mt-0.5 font-medium text-ink-800">
                  {detail.assigned_staff?.name ?? "Unassigned"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Services</p>
                <p className="mt-0.5 font-medium text-ink-800">{detail.services ?? "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Notes</p>
                <p className="mt-0.5 whitespace-pre-line text-ink-600">{detail.notes ?? "—"}</p>
              </div>
            </div>
            <p className="text-[10.5px] text-ink-400">
              Converted on {formatDateTime(detail.created_at)}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="md"
        title={editing ? `Edit ${editing.code}` : "Edit client"}
        description="Update the client account and current project status."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Business name" required error={errors.business_name} className="sm:col-span-2">
            <Input
              value={form.business_name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, business_name: event.target.value }))
              }
              invalid={Boolean(errors.business_name)}
            />
          </Field>
          <Field label="Contact person">
            <Input
              value={form.contact_person}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contact_person: event.target.value }))
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              invalid={Boolean(errors.email)}
            />
          </Field>
          <Field label="Project start date">
            <Input
              type="date"
              value={form.start_date}
              onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
            />
          </Field>
          <Field label="Project status">
            <Select
              value={form.project_status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, project_status: event.target.value }))
              }
            >
              {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned team member">
            <Select
              value={form.assigned_staff_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, assigned_staff_id: event.target.value }))
              }
            >
              <option value="">Unassigned</option>
              {(meta?.staff ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Services" className="sm:col-span-2">
            <Input
              value={form.services}
              onChange={(event) => setForm((prev) => ({ ...prev, services: event.target.value }))}
              placeholder="Website Development, SEO Services"
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

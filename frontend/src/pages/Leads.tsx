import {
  Building2,
  Download,
  Eye,
  FileText,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecordCallModal } from "../components/calls/RecordCallModal";
import { LeadFormModal } from "../components/leads/LeadFormModal";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { ActionMenu } from "../components/ui/ActionMenu";
import { Avatar } from "../components/ui/Avatar";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Column, DataTable, Pagination } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api, downloadFile } from "../lib/api";
import {
  CALL_OUTCOME_LABELS,
  FOLLOWUP_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  SOURCE_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  labelFor,
} from "../lib/format";
import type { Lead, Paginated } from "../lib/types";

const PAGE_SIZE = 10;

export function Leads() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [status, setStatus] = useState("all");
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callLeadId, setCallLeadId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingLead(null);
      setFormOpen(true);
    } else if (searchParams.get("q")) {
      setSearch(searchParams.get("q") ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.get<Paginated<Lead>>("/leads", {
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        staff_id: staffId || undefined,
        service_id: serviceId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load leads", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, staffId, serviceId, dateFrom, dateTo, sort, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingLead(null);
    if (searchParams.get("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  };

  const openDetail = async (lead: Lead) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const record = await api.get<Lead>(`/leads/${lead.id}`);
      setDetail(record);
    } catch (err) {
      toast.error("Could not load lead", err instanceof Error ? err.message : undefined);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const deleteLead = async () => {
    if (!deleteTarget) return;
    setActionBusy(true);
    try {
      await api.del(`/leads/${deleteTarget.id}`);
      toast.success("Lead deleted", `${deleteTarget.code} · ${deleteTarget.business_name}`);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error("Could not delete lead", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  const convertLead = async () => {
    if (!convertTarget) return;
    setActionBusy(true);
    try {
      const converted = await api.post<Lead>(`/leads/${convertTarget.id}/convert`);
      toast.success("Client created", `${converted.business_name} now appears under Clients.`);
      setConvertTarget(null);
      setDetailOpen(false);
      void load();
    } catch (err) {
      toast.error("Could not convert lead", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(
        "/leads/export.csv",
        {
          q: debouncedSearch || undefined,
          status: status === "all" ? undefined : status,
          staff_id: staffId || undefined,
          service_id: serviceId || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        "stackzyro-leads.csv"
      );
      toast.success("Export ready", "Your filtered leads were downloaded as a CSV file.");
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const activeFilters =
    Boolean(status !== "all" || staffId || serviceId || dateFrom || dateTo) || Boolean(search);

  const columns: Column<Lead>[] = [
    {
      key: "code",
      header: "Lead ID",
      render: (lead) => (
        <span className="whitespace-nowrap text-[11px] font-medium tabular text-ink-400">
          {lead.code}
        </span>
      ),
    },
    {
      key: "business",
      header: "Business name",
      render: (lead) => (
        <div className="min-w-[160px]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void openDetail(lead);
            }}
            className="text-left text-[12.5px] font-semibold text-ink-900 hover:text-brand-700"
          >
            {lead.business_name}
          </button>
          <p className="mt-0.5 text-[10.5px] text-ink-400">{lead.category ?? "Uncategorised"}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact person",
      render: (lead) => (
        <span className="whitespace-nowrap text-[12px] text-ink-600">
          {lead.contact_person ?? "—"}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (lead) => (
        <span className="whitespace-nowrap text-[11.5px] tabular text-ink-600">
          {lead.phone ?? "—"}
        </span>
      ),
    },
    {
      key: "services",
      header: "Interested service",
      render: (lead) => (
        <div className="flex max-w-[170px] flex-wrap gap-1">
          {lead.services.length === 0 ? (
            <span className="text-[11px] text-ink-400">—</span>
          ) : (
            <>
              <Badge tone="purple">{lead.services[0].name}</Badge>
              {lead.services.length > 1 ? (
                <Badge tone="grey">+{lead.services.length - 1}</Badge>
              ) : null}
            </>
          )}
        </div>
      ),
    },
    {
      key: "staff",
      header: "Assigned staff",
      render: (lead) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={lead.assigned_staff?.name} size="xs" />
          <span className="text-[11.5px] text-ink-600">
            {lead.assigned_staff?.name ?? "Unassigned"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Lead status",
      render: (lead) => <StatusBadge value={lead.status} labels={LEAD_STATUS_LABELS} />,
    },
    {
      key: "followup",
      header: "Next follow-up",
      render: (lead) =>
        lead.next_follow_up ? (
          <div className="whitespace-nowrap">
            <p className="text-[11.5px] font-medium text-ink-700">
              {formatDate(lead.next_follow_up)}
            </p>
            <p className="text-[10px] text-ink-400">{formatTime(lead.next_follow_up)}</p>
          </div>
        ) : (
          <span className="text-[11px] text-ink-400">Not scheduled</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (lead) => (
        <ActionMenu
          actions={[
            { label: "View details", icon: Eye, onClick: () => void openDetail(lead) },
            {
              label: "Edit lead",
              icon: Pencil,
              onClick: () => {
                setEditingLead(lead);
                setFormOpen(true);
              },
            },
            {
              label: "Record call",
              icon: PhoneCall,
              onClick: () => {
                setCallLeadId(lead.id);
                setCallOpen(true);
              },
            },
            {
              label: "Convert to client",
              icon: Building2,
              onClick: () => setConvertTarget(lead),
              hidden: lead.status === "converted",
            },
            {
              label: "Delete lead",
              icon: Trash2,
              danger: true,
              onClick: () => setDeleteTarget(lead),
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
        title="Leads"
        description="Every enquiry with its owner, status and next step. Calls attach to the lead, so repeat conversations never create duplicates."
        actions={
          <>
            <ModuleHelpButton moduleKey="leads" label="Lead Guide" />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={exportCsv}
              loading={exporting}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setEditingLead(null);
                setFormOpen(true);
              }}
            >
              Add lead
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardBody className="py-3.5">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Search" className="min-w-[190px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Business, contact, phone or lead ID"
              />
            </Field>
            <Field label="Status" className="w-[150px]">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
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
            <Field label="Service" className="w-[170px]">
              <Select
                value={serviceId}
                onChange={(event) => {
                  setServiceId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All services</option>
                {(meta?.services ?? []).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Created from" className="w-[140px]">
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
            <Field label="Sort" className="w-[135px]">
              <Select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="followup">Next follow-up</option>
                <option value="business">Business A–Z</option>
              </Select>
            </Field>
            {activeFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="mb-0.5"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setStaffId("");
                  setServiceId("");
                  setDateFrom("");
                  setDateTo("");
                  setSort("newest");
                  setPage(1);
                  setSearchParams({}, { replace: true });
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
          title="Lead register"
          subtitle="Unique businesses in the pipeline"
          action={<Badge tone="purple">{data?.total ?? 0} leads</Badge>}
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(lead) => lead.id}
          loading={loading}
          onRowClick={(lead) => void openDetail(lead)}
          emptyIcon={Users}
          emptyTitle={activeFilters ? "No leads match these filters" : "No leads yet"}
          emptyDescription={
            activeFilters
              ? "Try a different search term or clear the filters to see all leads."
              : "Add your first lead to start tracking calls and follow-ups."
          }
          emptyAction={
            !activeFilters ? (
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setFormOpen(true)}>
                Add lead
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setStaffId("");
                  setServiceId("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear filters
              </Button>
            )
          }
          minWidth="1180px"
        />
        <Pagination
          page={data?.page ?? 1}
          pages={data?.pages ?? 0}
          total={data?.total ?? 0}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </Card>

      <LeadFormModal
        open={formOpen}
        onClose={closeForm}
        lead={editingLead}
        onSaved={() => void load()}
      />

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="lg"
        title={detail ? detail.business_name : "Lead details"}
        description={detail ? `${detail.code} · ${detail.category ?? "General enquiry"}` : undefined}
        footer={
          detail ? (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Pencil className="h-3.5 w-3.5" />}
                onClick={() => {
                  setEditingLead(detail);
                  setDetailOpen(false);
                  setFormOpen(true);
                }}
              >
                Edit lead
              </Button>
              <Button
                size="sm"
                leftIcon={<PhoneCall className="h-3.5 w-3.5" />}
                onClick={() => {
                  setCallLeadId(detail.id);
                  setCallOpen(true);
                }}
              >
                Record call
              </Button>
            </>
          ) : null
        }
      >
        {detailLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={detail.status} labels={LEAD_STATUS_LABELS} />
              <Badge tone="grey">
                Source: {SOURCE_LABELS[detail.source ?? ""] ?? detail.source ?? "Not recorded"}
              </Badge>
              <Badge tone="grey">{detail.location ?? "No location"}</Badge>
              {detail.assigned_staff ? (
                <Badge tone="blue">Owner: {detail.assigned_staff.name}</Badge>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-lg border border-line bg-[#fcfbfe] p-3.5 text-[12px] sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Contact</p>
                <p className="mt-0.5 font-medium text-ink-800">{detail.contact_person ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Phone</p>
                <p className="mt-0.5 font-medium text-ink-800">{detail.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Email</p>
                <p className="mt-0.5 font-medium text-ink-800">{detail.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Next follow-up</p>
                <p className="mt-0.5 font-medium text-ink-800">
                  {detail.next_follow_up ? formatDateTime(detail.next_follow_up) : "Not scheduled"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Website</p>
                <p className="mt-0.5 truncate font-medium text-ink-800">{detail.website ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">Social</p>
                <p className="mt-0.5 truncate font-medium text-ink-800">
                  {detail.social_links ?? "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Interested services
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.services.length === 0 ? (
                  <span className="text-[12px] text-ink-400">No services selected.</span>
                ) : (
                  detail.services.map((service) => (
                    <Badge key={service.id} tone="purple">
                      {service.name}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {detail.requirements ? (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Requirements
                </p>
                <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-600">
                  {detail.requirements}
                </p>
              </div>
            ) : null}

            {detail.notes ? (
              <div className="rounded-lg bg-amber-50/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200/60">
                <span className="font-semibold">Internal note: </span>
                {detail.notes}
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Call history ({detail.calls?.length ?? 0})
              </p>
              {(detail.calls ?? []).length === 0 ? (
                <p className="text-[12px] text-ink-400">No calls recorded for this lead yet.</p>
              ) : (
                <div className="divide-y divide-line rounded-lg border border-line">
                  {(detail.calls ?? []).slice(0, 6).map((call) => (
                    <div key={call.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-medium text-ink-800">
                          {labelFor(CALL_OUTCOME_LABELS, call.outcome)}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-ink-400">
                          {formatDateTime(call.called_at)} · {call.staff?.name ?? "—"}
                        </p>
                        {call.notes ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-ink-500">{call.notes}</p>
                        ) : null}
                      </div>
                      <span className="whitespace-nowrap text-[10px] tabular text-ink-400">
                        {call.code}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Follow-ups
                </p>
                {(detail.follow_ups ?? []).length === 0 ? (
                  <p className="text-[11.5px] text-ink-400">No follow-ups scheduled.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(detail.follow_ups ?? []).slice(0, 4).map((followUp) => (
                      <div
                        key={followUp.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-[#fbf9ff] px-2.5 py-1.5"
                      >
                        <span className="text-[10.5px] text-ink-600">
                          {formatDate(followUp.due_at)}
                        </span>
                        <StatusBadge value={followUp.status} labels={FOLLOWUP_STATUS_LABELS} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                  Proposals
                </p>
                {(detail.proposals ?? []).length === 0 ? (
                  <p className="text-[11.5px] text-ink-400">No proposals created.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(detail.proposals ?? []).slice(0, 4).map((proposal) => (
                      <div
                        key={proposal.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-[#fbf9ff] px-2.5 py-1.5"
                      >
                        <span className="truncate text-[10.5px] text-ink-600">
                          {formatCurrency(proposal.amount)} · {proposal.code}
                        </span>
                        <StatusBadge value={proposal.status} labels={PROPOSAL_STATUS_LABELS} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {detail.status !== "converted" ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Building2 className="h-3.5 w-3.5" />}
                onClick={() => setConvertTarget(detail)}
              >
                Convert to client
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] font-medium text-emerald-700">
                <FileText className="h-3.5 w-3.5" />
                This lead is a confirmed client.
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <RecordCallModal
        open={callOpen}
        onClose={() => {
          setCallOpen(false);
          setCallLeadId(null);
        }}
        leadId={callLeadId}
        onSaved={() => {
          void load();
          if (detail) void openDetail(detail);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteLead}
        loading={actionBusy}
        title="Delete this lead?"
        description={`${deleteTarget?.business_name ?? ""} and its calls, follow-ups, proposals and meetings will be removed. This cannot be undone.`}
        confirmLabel="Delete lead"
      />

      <ConfirmDialog
        open={Boolean(convertTarget)}
        onClose={() => setConvertTarget(null)}
        onConfirm={convertLead}
        loading={actionBusy}
        destructive={false}
        title="Convert to client?"
        description={`${convertTarget?.business_name ?? ""} will be marked as converted and added to the Clients page as a confirmed client.`}
        confirmLabel="Convert to client"
      />
    </div>
  );
}

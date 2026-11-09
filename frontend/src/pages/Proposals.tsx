import {
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileEdit,
  FileText,
  Layers,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ActionMenu } from "../components/ui/ActionMenu";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Column, DataTable, Pagination } from "../components/ui/DataTable";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Field, Input, Select } from "../components/ui/Input";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api, downloadFile } from "../lib/api";
import {
  PROPOSAL_STATUS_LABELS,
  cn,
  formatCurrency,
  formatDate,
} from "../lib/format";
import type { Lead, Paginated, Proposal } from "../lib/types";

const PAGE_SIZE = 10;

interface ProposalStats {
  total: number;
  draft: number;
  pending_approval: number;
  approved: number;
  sent: number;
  accepted: number;
  rejected: number;
  expired?: number;
}

export function Proposals() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Proposal> | null>(null);
  const [stats, setStats] = useState<ProposalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{
    proposal: Proposal;
    decision: "accepted" | "rejected";
  } | null>(null);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(searchParams.get("new") === "1");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [createForm, setCreateForm] = useState({
    lead_id: "",
    template_key: "",
    title: "",
    service_type: "",
    amount: "",
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get<ProposalStats>("/proposals/stats");
      setStats(res);
    } catch {
      // stats failure shouldn't break list
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.get<Paginated<Proposal>>("/proposals", {
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
      });
      setData(payload);
      void loadStats();
    } catch (err) {
      toast.error("Could not load proposals", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, toast, loadStats]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
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
  }, [createOpen]);

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateErrors({});
    if (searchParams.get("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  };

  const applyTemplate = (key: string, businessName?: string) => {
    const template = meta?.proposal_templates.find((item) => item.key === key);
    setCreateForm((prev) => ({
      ...prev,
      template_key: key,
      service_type: template?.service ?? "",
      title: template
        ? businessName
          ? `${template.title} — ${businessName}`
          : template.title
        : prev.title,
    }));
  };

  const submitCreate = async () => {
    const errors: Record<string, string> = {};
    if (!createForm.lead_id) errors.lead_id = "Select a lead.";
    if (!createForm.template_key) errors.template_key = "Choose a proposal template.";
    if (createForm.title.trim().length < 2) errors.title = "Give the proposal a title.";
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setCreating(true);
    try {
      const proposal = await api.post<Proposal>("/proposals", {
        lead_id: Number(createForm.lead_id),
        template_key: createForm.template_key,
        title: createForm.title.trim(),
        service_type: createForm.service_type || null,
        amount: Number(createForm.amount) || 0,
        status: "draft",
      });
      toast.success("Proposal created", `${proposal.code} · continue editing the draft.`);
      closeCreate();
      navigate(`/proposals/${proposal.id}/edit`);
    } catch (err) {
      toast.error("Could not create proposal", err instanceof Error ? err.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadPdf = async (row: Proposal) => {
    setDownloadingId(row.id);
    try {
      await downloadFile(
        `/proposals/${row.id}/pdf`,
        { download: "true" },
        `${row.code}_${row.title.replace(/\s+/g, "_")}.pdf`
      );
      toast.success("PDF Downloaded", `Saved proposal ${row.code}`);
    } catch (err) {
      toast.error("PDF generation failed", err instanceof Error ? err.message : undefined);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShareWhatsApp = (row: Proposal) => {
    let phone = (row.phone ?? "").replace(/[^\d+]/g, "");
    if (!phone) {
      toast.error("Client phone missing", "No phone number found for this lead/client.");
      return;
    }
    if (phone.length === 10 && !phone.startsWith("+")) {
      phone = `91${phone}`;
    } else if (phone.startsWith("+")) {
      phone = phone.replace("+", "");
    }
    const appUrl = window.location.origin;
    const msg =
      `*STACKZYRO Proposal: ${row.code}*\n\n` +
      `Hello ${row.business_name ?? "Valued Client"},\n\n` +
      `Please find our commercial proposal for *${row.title}*.\n` +
      `• Total Quoted Amount: ${formatCurrency(row.amount, meta?.company.currency)}\n` +
      `• Proposal Reference: ${row.code}\n\n` +
      `You can review the interactive proposal document and download the official PDF here:\n` +
      `${appUrl}/proposals/${row.id}/preview\n\n` +
      `Warm regards,\n` +
      `STACKZYRO Digital Solutions`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleShareEmail = (row: Proposal) => {
    const email = row.email ?? "";
    const subject = `STACKZYRO Proposal: ${row.code} — ${row.title}`;
    const appUrl = window.location.origin;
    const body =
      `Dear ${row.contact_person || row.business_name || "Valued Client"},\n\n` +
      `Thank you for considering STACKZYRO Digital Solutions. We are pleased to submit our formal commercial proposal for ${row.title}.\n\n` +
      `Proposal Summary:\n` +
      `- Proposal Code: ${row.code}\n` +
      `- Service: ${row.service_type || "Digital Solutions"}\n` +
      `- Total Quoted Amount: ${formatCurrency(row.amount, meta?.company.currency)}\n\n` +
      `You can view the full specification, deliverables, timeline, and download the official A4 PDF version here:\n` +
      `${appUrl}/proposals/${row.id}/preview\n\n` +
      `Please let us know if you have any questions or require any adjustments.\n\n` +
      `Best regards,\n` +
      `The STACKZYRO Team\n` +
      `Email: ${meta?.company.email || "stackzyro@gmail.com"}\n` +
      `Website: ${meta?.company.website || "www.stackzyro.com"}`;

    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleApprove = async (proposal: Proposal) => {
    setActionBusy(true);
    try {
      await api.post(`/proposals/${proposal.id}/approve`);
      toast.success("Proposal approved", `${proposal.code} is now authorized to be sent.`);
      void load();
    } catch (err) {
      toast.error("Could not approve proposal", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  const markSent = async (proposal: Proposal) => {
    setActionBusy(true);
    try {
      await api.post(`/proposals/${proposal.id}/send`);
      toast.success("Proposal marked as sent", proposal.code);
      void load();
    } catch (err) {
      toast.error("Could not update proposal", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  const recordDecision = async () => {
    if (!decisionTarget) return;
    setActionBusy(true);
    try {
      await api.post(`/proposals/${decisionTarget.proposal.id}/decision`, {
        status: decisionTarget.decision,
      });
      toast.success(
        decisionTarget.decision === "accepted" ? "Proposal accepted" : "Proposal rejected",
        decisionTarget.proposal.code
      );
      setDecisionTarget(null);
      void load();
    } catch (err) {
      toast.error("Could not record decision", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  const deleteProposal = async () => {
    if (!deleteTarget) return;
    setActionBusy(true);
    try {
      await api.del(`/proposals/${deleteTarget.id}`);
      toast.success("Proposal deleted", deleteTarget.code);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error("Could not delete proposal", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  const canApprove =
    user?.role === "admin" || (user?.permissions?.proposals ?? []).includes("approve");

  const statCards = [
    {
      key: "all",
      label: "Total proposals",
      count: stats?.total ?? data?.total ?? 0,
      icon: Layers,
      color: "text-brand-600 bg-brand-50 border-brand-200",
    },
    {
      key: "draft",
      label: "Draft proposals",
      count: stats?.draft ?? 0,
      icon: FileEdit,
      color: "text-slate-600 bg-slate-50 border-slate-200",
    },
    {
      key: "pending_approval",
      label: "Pending approval",
      count: stats?.pending_approval ?? 0,
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
    {
      key: "approved",
      label: "Approved proposals",
      count: stats?.approved ?? 0,
      icon: FileCheck,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      key: "sent",
      label: "Sent proposals",
      count: stats?.sent ?? 0,
      icon: Send,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    },
    {
      key: "accepted",
      label: "Accepted proposals",
      count: stats?.accepted ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      key: "rejected",
      label: "Rejected proposals",
      count: stats?.rejected ?? 0,
      icon: XCircle,
      color: "text-rose-600 bg-rose-50 border-rose-200",
    },
  ];

  const columns: Column<Proposal>[] = [
    {
      key: "code",
      header: "Proposal ID",
      render: (row) => (
        <span className="whitespace-nowrap text-[11px] font-semibold tabular text-brand-700">
          {row.code}
        </span>
      ),
    },
    {
      key: "business",
      header: "Client / Lead",
      render: (row) => (
        <div>
          <span className="whitespace-nowrap text-[12.5px] font-semibold text-ink-900">
            {row.business_name || "—"}
          </span>
          {row.contact_person ? (
            <p className="text-[10.5px] text-ink-500">{row.contact_person}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "title",
      header: "Proposal title",
      render: (row) => (
        <div className="max-w-[220px]">
          <p className="truncate text-[12px] font-medium text-ink-700">{row.title}</p>
          <p className="mt-0.5 text-[10px] text-ink-400">By {row.created_by?.name ?? "Admin"}</p>
        </div>
      ),
    },
    {
      key: "service",
      header: "Service type",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] font-medium text-ink-600">
          {row.service_type ?? "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created date",
      render: (row) => (
        <span className="whitespace-nowrap text-[11.5px] text-ink-600">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => (
        <span className="whitespace-nowrap text-[12px] font-semibold tabular text-ink-900">
          {formatCurrency(row.amount, meta?.company.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} labels={PROPOSAL_STATUS_LABELS} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <ActionMenu
          actions={[
            {
              label: "Preview Document",
              icon: Eye,
              onClick: () => navigate(`/proposals/${row.id}/preview`),
            },
            {
              label: downloadingId === row.id ? "Generating PDF…" : "Download PDF",
              icon: Download,
              onClick: () => void handleDownloadPdf(row),
            },
            {
              label: "Share via WhatsApp",
              icon: MessageCircle,
              onClick: () => handleShareWhatsApp(row),
            },
            {
              label: "Share via Email",
              icon: Mail,
              onClick: () => handleShareEmail(row),
            },
            {
              label: "Approve proposal",
              icon: CheckCircle,
              hidden: !canApprove || !["draft", "pending_approval"].includes(row.status),
              onClick: () => void handleApprove(row),
            },
            {
              label: "Edit proposal",
              icon: Pencil,
              onClick: () => navigate(`/proposals/${row.id}/edit`),
            },
            {
              label: "Mark as sent",
              icon: Send,
              onClick: () => void markSent(row),
              hidden: !["draft", "pending_approval", "approved"].includes(row.status),
            },
            {
              label: "Record acceptance",
              icon: CheckCircle2,
              onClick: () => setDecisionTarget({ proposal: row, decision: "accepted" }),
              hidden: !["sent", "pending_approval", "approved"].includes(row.status),
            },
            {
              label: "Record rejection",
              icon: XCircle,
              onClick: () => setDecisionTarget({ proposal: row, decision: "rejected" }),
              hidden: !["sent", "pending_approval", "approved"].includes(row.status),
            },
            {
              label: "Delete proposal",
              icon: Trash2,
              danger: true,
              onClick: () => setDeleteTarget(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Proposals & Commercial Offers"
        description="Prepare professional client proposals from 8 verified service templates, export publication-ready A4 PDFs, and manage client approvals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ModuleHelpButton moduleKey="proposals" label="Proposal Manual" />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="h-3.5 w-3.5 text-brand-600" />}
              onClick={() => setTemplatesOpen(true)}
            >
              Proposal Templates
            </Button>
            <Link to="/proposals/new">
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                Create proposal
              </Button>
            </Link>
          </div>
        }
      />

      {/* 7 Proposal Dashboard KPI Cards */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isActive = status === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setStatus(card.key);
                setPage(1);
              }}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all",
                isActive
                  ? "border-brand-500 bg-brand-50/60 shadow-sm ring-1 ring-brand-500"
                  : "border-line bg-white hover:border-brand-200 hover:bg-brand-50/20"
              )}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-semibold text-ink-600 truncate">{card.label}</span>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                    card.color
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold tabular text-ink-900">{card.count}</span>
                {isActive ? (
                  <span className="text-[10px] font-medium text-brand-600">Active</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <Card className="mb-4">
        <CardBody className="py-3.5">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Search proposals" className="min-w-[220px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by Proposal ID, business name, or title"
              />
            </Field>
            <Field label="Status filter" className="w-[190px]">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses ({stats?.total ?? 0})</option>
                {Object.entries(PROPOSAL_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} {stats && value in stats ? `(${stats[value as keyof ProposalStats]})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {status !== "all" || search ? (
              <Button
                variant="ghost"
                size="sm"
                className="mb-0.5"
                onClick={() => {
                  setStatus("all");
                  setSearch("");
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
          title="Proposal Register"
          subtitle="Comprehensive history of commercial quotes, approvals, and decisions"
          action={
            <div className="flex items-center gap-2">
              <Badge tone="purple">{data?.total ?? 0} total proposals</Badge>
            </div>
          }
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          minWidth="1080px"
          emptyIcon={FileText}
          emptyTitle="No proposals found"
          emptyDescription="Start from one of our 8 service templates to prepare a client proposal in seconds."
          emptyAction={
            <Link to="/proposals/new">
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                Create proposal
              </Button>
            </Link>
          }
          onRowClick={(row) => navigate(`/proposals/${row.id}/preview`)}
        />
        <Pagination
          page={data?.page ?? 1}
          pages={data?.pages ?? 0}
          total={data?.total ?? 0}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </Card>

      {/* 8 Proposal Templates Catalog Modal */}
      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title="STACKZYRO Proposal Templates Catalog"
        description="Standardized commercial proposals with pre-configured scope, deliverables, milestone timelines, and terms."
        size="xl"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(meta?.proposal_templates ?? []).map((t) => (
            <div
              key={t.key}
              className="flex flex-col justify-between rounded-xl border border-line bg-white p-4 transition-all hover:border-brand-300 hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="purple">{t.service}</Badge>
                  <span className="text-[10px] font-medium text-ink-400">A4 PDF Ready</span>
                </div>
                <h4 className="mt-2 text-sm font-semibold text-ink-900">{t.name}</h4>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                  {t.overview.replace("{business}", "the client's enterprise")}
                </p>
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    Key Scope Deliverables
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {t.scope.slice(0, 3).map((s, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-xs text-ink-600">
                        <span className="text-brand-500">✓</span>
                        <span className="truncate">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-500">
                  {t.timeline.length} Phase Timeline
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setTemplatesOpen(false);
                    navigate(`/proposals/new?template=${t.key}`);
                  }}
                >
                  Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Quick Create Modal */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Quick Create Proposal"
        description="Select a lead and template. You will be redirected to the editor to customize details."
        footer={
          <>
            <Button variant="outline" onClick={closeCreate} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={submitCreate} loading={creating}>
              Continue to editor
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Lead / business" required error={createErrors.lead_id}>
            <Select
              value={createForm.lead_id}
              onChange={(event) => {
                const lead = leads.find((item) => item.id === Number(event.target.value));
                setCreateForm((prev) => ({
                  ...prev,
                  lead_id: event.target.value,
                  title:
                    prev.template_key && lead
                      ? `${meta?.proposal_templates.find((item) => item.key === prev.template_key)?.title ?? ""} — ${lead.business_name}`
                      : prev.title,
                }));
                setCreateErrors((prev) => ({ ...prev, lead_id: "" }));
              }}
              invalid={Boolean(createErrors.lead_id)}
            >
              <option value="">Select a lead</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.business_name} · {lead.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proposal template" required error={createErrors.template_key}>
            <Select
              value={createForm.template_key}
              onChange={(event) => {
                const lead = leads.find((item) => item.id === Number(createForm.lead_id));
                applyTemplate(event.target.value, lead?.business_name);
                setCreateErrors((prev) => ({ ...prev, template_key: "" }));
              }}
              invalid={Boolean(createErrors.template_key)}
            >
              <option value="">Choose a template</option>
              {(meta?.proposal_templates ?? []).map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proposal title" required error={createErrors.title}>
            <Input
              value={createForm.title}
              onChange={(event) => {
                setCreateForm((prev) => ({ ...prev, title: event.target.value }));
                setCreateErrors((prev) => ({ ...prev, title: "" }));
              }}
              invalid={Boolean(createErrors.title)}
              placeholder="e.g. Corporate Website Development"
            />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Service type">
              <Input
                value={createForm.service_type}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, service_type: event.target.value }))
                }
                placeholder="Website Development"
              />
            </Field>
            <Field label={`Amount (${meta?.company.currency ?? "INR"})`}>
              <Input
                type="number"
                min="0"
                step="1000"
                value={createForm.amount}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, amount: event.target.value }))
                }
                placeholder="85000"
              />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(decisionTarget)}
        onClose={() => setDecisionTarget(null)}
        onConfirm={recordDecision}
        loading={actionBusy}
        destructive={decisionTarget?.decision === "rejected"}
        title={
          decisionTarget?.decision === "accepted"
            ? "Record client acceptance?"
            : "Record client rejection?"
        }
        description={
          decisionTarget?.decision === "accepted"
            ? `${decisionTarget?.proposal.code ?? ""} will be marked accepted and the lead will be converted/updated.`
            : `${decisionTarget?.proposal.code ?? ""} will be marked rejected. You can edit and resend it later.`
        }
        confirmLabel={decisionTarget?.decision === "accepted" ? "Mark accepted" : "Mark rejected"}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteProposal}
        loading={actionBusy}
        title="Delete this proposal?"
        description={`${deleteTarget?.code ?? ""} and its content will be permanently removed.`}
        confirmLabel="Delete proposal"
      />
    </div>
  );
}

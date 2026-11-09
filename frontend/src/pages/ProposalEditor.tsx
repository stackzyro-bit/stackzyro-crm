import {
  ArrowLeft,
  Eye,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProposalDocument } from "../components/proposals/ProposalDocument";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field, Input, Textarea } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { PROPOSAL_STATUS_LABELS, formatCurrency, formatDateTime } from "../lib/format";
import type { Proposal, ProposalContent } from "../lib/types";

function normalizeContent(proposal: Proposal): ProposalContent {
  const raw = proposal.content ?? ({} as Partial<ProposalContent>);
  return {
    overview: raw.overview ?? "",
    requirements: raw.requirements ?? [],
    scope: raw.scope ?? [],
    deliverables: raw.deliverables ?? [],
    timeline: raw.timeline ?? [],
    pricing: (raw.pricing ?? []).map((row) => ({
      item: row.item ?? "",
      description: row.description ?? "",
      qty: Number(row.qty) || 0,
      rate: Number(row.rate) || 0,
      amount: Number(row.amount) || Number(row.qty) * Number(row.rate) || 0,
    })),
    subtotal: Number(raw.subtotal) || 0,
    discount: Number(raw.discount) || 0,
    tax_rate: Number(raw.tax_rate) || 0,
    total: Number(raw.total) || Number(proposal.amount) || 0,
    payment_terms: raw.payment_terms ?? "",
    additional_costs: raw.additional_costs ?? "",
    terms: raw.terms ?? [],
    valid_until: raw.valid_until ?? null,
    client_email: raw.client_email ?? "",
    client_phone: raw.client_phone ?? "",
    client_location: raw.client_location ?? "",
  };
}

function ListEditor({
  label,
  description,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  description?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink-600">{label}</p>
          {description ? <p className="text-[10.5px] text-ink-400">{description}</p> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="h-3 w-3" />}
          onClick={() => onChange([...items, ""])}
        >
          Add
        </Button>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[11px] text-ink-400">
            No items yet. Use Add to create a line.
          </p>
        ) : (
          items.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={item}
                onChange={(event) => {
                  const next = [...items];
                  next[index] = event.target.value;
                  onChange(next);
                }}
                placeholder={placeholder}
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remove item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ProposalEditor() {
  const { id } = useParams();
  const { meta } = useMeta();
  const toast = useToast();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [content, setContent] = useState<ProposalContent | null>(null);
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const record = await api.get<Proposal>(`/proposals/${id}`);
      setProposal(record);
      setContent(normalizeContent(record));
      setTitle(record.title);
      setServiceType(record.service_type ?? "");
    } catch (err) {
      toast.error("Could not load proposal", err instanceof Error ? err.message : undefined);
      navigate("/proposals");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const rows = content?.pricing ?? [];
    const subtotal = rows.reduce(
      (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.rate) || 0),
      0
    );
    const discount = Number(content?.discount) || 0;
    const taxRate = Number(content?.tax_rate) || 0;
    const taxable = Math.max(subtotal - discount, 0);
    const tax = (taxable * taxRate) / 100;
    return { subtotal, discount, taxRate, tax, total: taxable + tax };
  }, [content]);

  const update = <K extends keyof ProposalContent>(key: K, value: ProposalContent[K]) => {
    setContent((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updatePricing = (
    index: number,
    key: "item" | "description" | "qty" | "rate",
    value: string
  ) => {
    setContent((prev) => {
      if (!prev) return prev;
      const pricing = prev.pricing.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (key === "qty" || key === "rate") {
          const numeric = Number(value) || 0;
          const nextRow = { ...row, [key]: numeric };
          return { ...nextRow, amount: nextRow.qty * nextRow.rate };
        }
        return { ...row, [key]: value };
      });
      return { ...prev, pricing };
    });
  };

  const save = async (options: { goToPreview?: boolean; markSent?: boolean } = {}) => {
    if (!proposal || !content) return false;
    if (title.trim().length < 2) {
      toast.error("Proposal needs a title", "Add a title before saving.");
      return false;
    }
    setSaving(true);
    try {
      const payloadContent: ProposalContent = {
        ...content,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax_rate: totals.taxRate,
        total: totals.total,
      };
      const updated = await api.patch<Proposal>(`/proposals/${proposal.id}`, {
        title: title.trim(),
        service_type: serviceType || null,
        content: payloadContent,
        amount: totals.total,
      });
      setProposal(updated);
      setContent(normalizeContent(updated));
      toast.success("Proposal saved", `${updated.code} · ${formatCurrency(totals.total, meta?.company.currency)}`);

      if (options.markSent) {
        setSending(true);
        const sent = await api.post<Proposal>(`/proposals/${proposal.id}/send`);
        setProposal(sent);
        toast.success("Proposal marked as sent", sent.code);
      }
      if (options.goToPreview) {
        navigate(`/proposals/${proposal.id}/preview`);
      }
      return true;
    } catch (err) {
      toast.error("Could not save proposal", err instanceof Error ? err.message : undefined);
      return false;
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  if (loading || !proposal || !content) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Card className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  const previewProposal: Proposal = {
    ...proposal,
    title,
    service_type: serviceType,
    amount: totals.total,
  };
  const previewContent: ProposalContent = {
    ...content,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax_rate: totals.taxRate,
    total: totals.total,
  };

  return (
    <div>
      <PageHeader
        title={`Edit ${proposal.code}`}
        description={`${proposal.business_name} · created ${formatDateTime(proposal.created_at)}`}
        actions={
          <>
            <Link to="/proposals">
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                Proposals
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Eye className="h-3.5 w-3.5" />}
              onClick={() => void save({ goToPreview: true })}
            >
              Preview & PDF
            </Button>
            {["draft", "pending_approval", "approved"].includes(proposal.status) ? (
              <Button
                variant="secondary"
                size="sm"
                loading={sending}
                leftIcon={<Send className="h-3.5 w-3.5" />}
                onClick={() => void save({ markSent: true })}
              >
                Mark as sent
              </Button>
            ) : null}
            <Button
              size="sm"
              loading={saving}
              leftIcon={<Save className="h-3.5 w-3.5" />}
              onClick={() => void save()}
            >
              Save draft
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={proposal.status} labels={PROPOSAL_STATUS_LABELS} />
        <Badge tone="grey">Amount: {formatCurrency(totals.total, meta?.company.currency)}</Badge>
        <Badge tone="grey">{proposal.template_key?.replace(/-/g, " ")}</Badge>
        <span className="text-[10.5px] text-ink-400">
          Last updated {formatDateTime(proposal.updated_at)}
        </span>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Proposal details" subtitle="Title, service and validity" />
            <CardBody className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Proposal title" required className="sm:col-span-2">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Field label="Service type">
                <Input
                  value={serviceType}
                  onChange={(event) => setServiceType(event.target.value)}
                  placeholder="Website Development"
                />
              </Field>
              <Field label="Valid until">
                <Input
                  type="date"
                  value={content.valid_until ?? ""}
                  onChange={(event) => update("valid_until", event.target.value || null)}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Overview & requirements" subtitle="Set the context for the client" />
            <CardBody className="space-y-4">
              <Field label="Project overview">
                <Textarea
                  rows={5}
                  value={content.overview}
                  onChange={(event) => update("overview", event.target.value)}
                  placeholder="Describe the business, the challenge and the outcome."
                />
              </Field>
              <ListEditor
                label="Client requirements"
                description="One requirement per line."
                items={content.requirements}
                onChange={(items) => update("requirements", items)}
                placeholder="e.g. Online appointment booking"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Scope & deliverables" subtitle="Exactly what is included" />
            <CardBody className="space-y-5">
              <ListEditor
                label="Scope of work"
                description="Shown as a two-column checklist in the document."
                items={content.scope}
                onChange={(items) => update("scope", items)}
                placeholder="e.g. Responsive front-end development"
              />
              <ListEditor
                label="Deliverables"
                items={content.deliverables}
                onChange={(items) => update("deliverables", items)}
                placeholder="e.g. Design source files"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Timeline" subtitle="Phases and delivery duration" />
            <CardBody>
              <div className="space-y-2">
                {content.timeline.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[11px] text-ink-400">
                    No phases yet. Add the first delivery phase.
                  </p>
                ) : (
                  content.timeline.map((row, index) => (
                    <div key={index} className="grid grid-cols-[1fr_150px_36px] items-center gap-2">
                      <Input
                        value={row.phase}
                        onChange={(event) => {
                          const next = [...content.timeline];
                          next[index] = { ...row, phase: event.target.value };
                          update("timeline", next);
                        }}
                        placeholder="Phase name"
                      />
                      <Input
                        value={row.duration}
                        onChange={(event) => {
                          const next = [...content.timeline];
                          next[index] = { ...row, duration: event.target.value };
                          update("timeline", next);
                        }}
                        placeholder="e.g. 5 days"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          update(
                            "timeline",
                            content.timeline.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove phase"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                leftIcon={<Plus className="h-3 w-3" />}
                onClick={() => update("timeline", [...content.timeline, { phase: "", duration: "" }])}
              >
                Add phase
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Pricing"
              subtitle="Line items, discount and tax"
              action={<Badge tone="purple">Total {formatCurrency(totals.total, meta?.company.currency)}</Badge>}
            />
            <CardBody>
              <div className="space-y-2">
                {content.pricing.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[11px] text-ink-400">
                    No pricing lines yet. Add the first item.
                  </p>
                ) : (
                  content.pricing.map((row, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 items-center gap-2 rounded-lg border border-line p-2"
                    >
                      <Input
                        className="col-span-12 sm:col-span-5"
                        value={row.item}
                        onChange={(event) => updatePricing(index, "item", event.target.value)}
                        placeholder="Item or service"
                      />
                      <Input
                        className="col-span-3 sm:col-span-2"
                        type="number"
                        min="0"
                        value={row.qty}
                        onChange={(event) => updatePricing(index, "qty", event.target.value)}
                        aria-label="Quantity"
                        placeholder="Qty"
                      />
                      <Input
                        className="col-span-4 sm:col-span-2"
                        type="number"
                        min="0"
                        value={row.rate}
                        onChange={(event) => updatePricing(index, "rate", event.target.value)}
                        aria-label="Rate"
                        placeholder="Rate"
                      />
                      <div className="col-span-4 flex items-center justify-end pr-1 text-[11.5px] font-semibold tabular text-ink-800 sm:col-span-2">
                        {formatCurrency((Number(row.qty) || 0) * (Number(row.rate) || 0), meta?.company.currency)}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          update(
                            "pricing",
                            content.pricing.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        className="col-span-1 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove pricing line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Plus className="h-3 w-3" />}
                  onClick={() =>
                    update("pricing", [
                      ...content.pricing,
                      { item: "", description: "", qty: 1, rate: 0, amount: 0 },
                    ])
                  }
                >
                  Add line item
                </Button>
                <div className="ml-auto flex flex-wrap items-end gap-3">
                  <Field label="Discount" className="w-[120px]">
                    <Input
                      type="number"
                      min="0"
                      value={content.discount}
                      onChange={(event) => update("discount", Number(event.target.value) || 0)}
                    />
                  </Field>
                  <Field label="Tax %" className="w-[100px]">
                    <Input
                      type="number"
                      min="0"
                      value={content.tax_rate}
                      onChange={(event) => update("tax_rate", Number(event.target.value) || 0)}
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-4 ml-auto w-full max-w-[280px] space-y-1.5 border-t border-line pt-3 text-[12px]">
                <div className="flex justify-between text-ink-500">
                  <span>Subtotal</span>
                  <span className="tabular">{formatCurrency(totals.subtotal, meta?.company.currency)}</span>
                </div>
                {totals.discount > 0 ? (
                  <div className="flex justify-between text-ink-500">
                    <span>Discount</span>
                    <span className="tabular">− {formatCurrency(totals.discount, meta?.company.currency)}</span>
                  </div>
                ) : null}
                {totals.taxRate > 0 ? (
                  <div className="flex justify-between text-ink-500">
                    <span>Tax ({totals.taxRate}%)</span>
                    <span className="tabular">{formatCurrency(totals.tax, meta?.company.currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-line pt-2 text-[13px] font-semibold text-brand-800">
                  <span>Total</span>
                  <span className="tabular">{formatCurrency(totals.total, meta?.company.currency)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payment terms & terms" subtitle="Commercial conditions" />
            <CardBody className="space-y-4">
              <Field label="Payment terms">
                <Textarea
                  rows={3}
                  value={content.payment_terms}
                  onChange={(event) => update("payment_terms", event.target.value)}
                />
              </Field>
              <Field label="Additional costs">
                <Textarea
                  rows={2}
                  value={content.additional_costs}
                  onChange={(event) => update("additional_costs", event.target.value)}
                  placeholder="Domain, hosting, ads, licences…"
                />
              </Field>
              <ListEditor
                label="Terms & conditions"
                items={content.terms}
                onChange={(items) => update("terms", items)}
                placeholder="e.g. Two rounds of revisions are included"
              />
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <Link to="/proposals">
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Eye className="h-3.5 w-3.5" />}
                onClick={() => void save({ goToPreview: true })}
              >
                Save & preview
              </Button>
              <Button
                size="sm"
                loading={saving}
                leftIcon={<Save className="h-3.5 w-3.5" />}
                onClick={() => void save()}
              >
                Save proposal
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden 2xl:block">
          <div className="sticky top-[92px]">
            <Card className="overflow-hidden">
              <CardHeader
                title="Live preview"
                subtitle="A4 document · scales to fit"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Eye className="h-3 w-3" />}
                    onClick={() => void save({ goToPreview: true })}
                  >
                    Open
                  </Button>
                }
              />
              <div className="h-[660px] overflow-hidden bg-[#f4f1fa] p-4">
                <div
                  style={{
                    width: "794px",
                    transform: "scale(0.5)",
                    transformOrigin: "top left",
                  }}
                >
                  <ProposalDocument
                    proposal={previewProposal}
                    company={meta?.company ?? {
                      name: "STACKZYRO",
                      tagline: "Turning Ideas Into Digital Solutions",
                      email: "",
                      phone: "",
                      website: "",
                      address: "",
                      logo: "",
                      currency: "INR",
                      proposal_footer: "",
                    }}
                    content={previewContent}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

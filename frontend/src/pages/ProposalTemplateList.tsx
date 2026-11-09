import {
  Check,
  Clock,
  Copy,
  Cpu,
  Eye,
  FileCode,
  FilePlus,
  FileText,
  Filter,
  Layers,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Input, Select } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { ProposalDocument } from "../components/proposals/ProposalDocument";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { Proposal, ProposalContent, ProposalTemplate } from "../lib/types";

export function ProposalTemplateList() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<ProposalTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProposalTemplate | null>(null);
  const [duplicatingKey, setDuplicatingKey] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ProposalTemplate[]>("/proposals/templates");
      setTemplates(data);
    } catch (err) {
      toast.error("Could not load templates", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleDuplicate = async (tmpl: ProposalTemplate) => {
    setDuplicatingKey(tmpl.key);
    try {
      const dup = await api.post<ProposalTemplate>(`/proposals/templates/${tmpl.key}/duplicate`);
      toast.success("Template Duplicated", `Created ${dup.name}`);
      void loadTemplates();
    } catch (err) {
      toast.error("Could not duplicate template", err instanceof Error ? err.message : undefined);
    } finally {
      setDuplicatingKey(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/proposals/templates/${deleteTarget.key}`);
      toast.success("Template Deleted", `Removed ${deleteTarget.name}`);
      setDeleteTarget(null);
      void loadTemplates();
    } catch (err) {
      toast.error("Could not delete template", err instanceof Error ? err.message : undefined);
    }
  };

  const services = Array.from(new Set(templates.map((t) => t.service).filter(Boolean)));

  const filtered = templates.filter((t) => {
    const matchesSearch =
      search.trim() === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.service.toLowerCase().includes(search.toLowerCase()) ||
      (t.overview && t.overview.toLowerCase().includes(search.toLowerCase()));
    const matchesService = serviceFilter === "all" || t.service === serviceFilter;
    return matchesSearch && matchesService;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposal Templates"
        description="Build, edit, duplicate, and manage standard & enterprise proposal templates with STACKZYRO brand formatting."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/proposals">
              <Button variant="ghost" size="sm" leftIcon={<FileText className="h-4 w-4" />}>
                All Proposals
              </Button>
            </Link>
            {user?.role === "admin" && (
              <Link to="/proposals/templates/new">
                <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  New Template
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* FILTER BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name, service or keywords..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-ink-400" />
          <Select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-56"
          >
            <option value="all">All Services ({templates.length})</option>
            {services.map((svc) => (
              <option key={svc} value={svc}>
                {svc}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* TEMPLATE CARDS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-64 animate-pulse p-6">
              <div className="h-4 w-1/3 rounded bg-ink-100" />
              <div className="mt-4 h-6 w-3/4 rounded bg-ink-100" />
              <div className="mt-2 h-16 w-full rounded bg-ink-100" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-ink-300" />
          <p className="mt-3 text-base font-semibold text-ink-800">No proposal templates found</p>
          <p className="mt-1 text-sm text-ink-500">
            Try adjusting your search filter or create a new custom proposal template.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tmpl) => {
            const isCustom = tmpl.is_custom;
            return (
              <Card
                key={tmpl.key}
                className="group flex flex-col justify-between transition-all hover:border-[#7838ED]/50 hover:shadow-md"
              >
                <CardBody className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone={tmpl.key === "hospital-erp" ? "purple" : "grey"}>
                      {tmpl.service}
                    </Badge>
                    {isCustom ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Custom
                      </span>
                    ) : (
                      <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7838ED]">
                        Standard
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-base font-bold text-ink-900 line-clamp-1 group-hover:text-[#7838ED]">
                    {tmpl.name}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-ink-500 line-clamp-1">
                    {tmpl.title}
                  </p>

                  <p className="mt-2.5 text-xs text-ink-600 line-clamp-3 leading-relaxed">
                    {tmpl.overview.replace("{business}", "the Client Organization")}
                  </p>

                  {/* Highlights */}
                  <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[11px] text-ink-600">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">Scope Deliverables:</span>
                      <span className="font-semibold text-ink-700">
                        {tmpl.scope?.length || 0} items · {tmpl.deliverables?.length || 0} outputs
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">Timeline:</span>
                      <span className="font-semibold text-ink-700">
                        {tmpl.timeline?.length || 0} milestone phases
                      </span>
                    </div>
                    {tmpl.tech_stack && tmpl.tech_stack.length > 0 && (
                      <div className="flex items-center gap-1 overflow-hidden pt-1">
                        <Cpu className="h-3 w-3 shrink-0 text-[#7838ED]" />
                        <span className="truncate text-[10.5px] text-[#5425B8]">
                          {tmpl.tech_stack.slice(0, 3).join(", ")}
                          {tmpl.tech_stack.length > 3 ? "..." : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </CardBody>

                <div className="flex items-center justify-between border-t border-line bg-canvas/40 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Quick Preview"
                      onClick={() => setPreviewTemplate(tmpl)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Duplicate Template"
                      loading={duplicatingKey === tmpl.key}
                      onClick={() => void handleDuplicate(tmpl)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {isCustom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete Custom Template"
                        onClick={() => setDeleteTarget(tmpl)}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link to={`/proposals/templates/${tmpl.key}/edit`}>
                      <Button variant="outline" size="sm" leftIcon={<Pencil className="h-3 w-3" />}>
                        Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      leftIcon={<FilePlus className="h-3 w-3" />}
                      onClick={() => navigate(`/proposals?new=1&template=${tmpl.key}`)}
                    >
                      Use
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* QUICK PREVIEW MODAL */}
      {previewTemplate && (
        <Modal
          open={Boolean(previewTemplate)}
          onClose={() => setPreviewTemplate(null)}
          title={`Template Preview: ${previewTemplate.name}`}
          size="xl"
        >
          <div className="max-h-[75vh] overflow-y-auto p-4 bg-[#f4f1fa]">
            <ProposalDocument
              proposal={{
                id: 0,
                code: `SAMPLE-${previewTemplate.key.toUpperCase()}`,
                lead_id: 0,
                lead_code: "LD-SAMPLE",
                business_name: "Apex Enterprises",
                contact_person: "Executive Director",
                title: previewTemplate.title,
                service_type: previewTemplate.service,
                client_id: null,
                status: "approved",
                amount: 250000,
                template_key: previewTemplate.key,
                created_by: user,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sent_at: null,
                decided_at: null,
              }}
              company={meta?.company}
              content={{
                overview: previewTemplate.overview.replace("{business}", "Apex Enterprises"),
                requirements: [
                  "Modernize operations and digitize key departmental workflows",
                  "Ensure enterprise compliance, reporting, and high availability",
                ],
                scope: previewTemplate.scope || [],
                deliverables: previewTemplate.deliverables || [],
                tech_stack: previewTemplate.tech_stack || [],
                timeline: previewTemplate.timeline || [],
                pricing: previewTemplate.pricing || [
                  {
                    item: previewTemplate.name,
                    description: "End-to-end delivery, architecture, and deployment",
                    qty: 1,
                    rate: 250000,
                    amount: 250000,
                  },
                ],
                subtotal: 250000,
                discount: 10000,
                tax_rate: 18,
                total: 283200,
                payment_terms: previewTemplate.payment_terms || "",
                additional_costs: previewTemplate.additional_costs || "",
                support_terms: previewTemplate.support_terms || "",
                terms: previewTemplate.terms || [],
                valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                client_email: "director@apexenterprises.in",
                client_phone: "+91 98765 43210",
                client_location: "Hyderabad, India",
              }}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-line p-4">
            <Button variant="ghost" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
            <Link to={`/proposals/templates/${previewTemplate.key}/edit`}>
              <Button leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                Edit This Template
              </Button>
            </Link>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Custom Template?"
        description={`Are you sure you want to delete the custom template "${deleteTarget?.name}"? Proposals already created with this template will not be affected.`}
        confirmLabel="Delete Template"
        destructive
      />
    </div>
  );
}

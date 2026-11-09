import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  DollarSign,
  FileCheck,
  FileText,
  Layers,
  Percent,
  Plus,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field, Input, Select, Textarea } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { cn, formatCurrency } from "../lib/format";
import type { Client, Lead, Paginated, PricingRow, Proposal, TimelinePhase } from "../lib/types";

export function CreateProposal() {
  const { meta } = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Target entity selection: "lead" or "client"
  const [targetType, setTargetType] = useState<"lead" | "client">("lead");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);

  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Client info fields (auto-populated and editable)
  const [businessName, setBusinessName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [proposalDate, setProposalDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [validDays, setValidDays] = useState("30");

  // Selected template keys (multi-service support)
  const [selectedTemplateKeys, setSelectedTemplateKeys] = useState<string[]>(() => {
    const fromUrl = searchParams.get("template");
    return fromUrl ? [fromUrl] : ["website-development"];
  });

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [scopeItems, setScopeItems] = useState<string[]>([]);
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelinePhase[]>([]);
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("18"); // 18% GST standard
  const [paymentTerms, setPaymentTerms] = useState(
    "50% Advance on project initiation.\n30% On UI/UX approval and core development milestone.\n20% On QA sign-off and production deployment."
  );
  const [terms, setTerms] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fetch leads and clients on load
  useEffect(() => {
    let active = true;
    setLoadingTargets(true);
    Promise.all([
      api.get<Paginated<Lead>>("/leads", { page_size: 100, sort: "business" }),
      api.get<Paginated<Client>>("/clients", { page_size: 100 }),
    ])
      .then(([leadsRes, clientsRes]) => {
        if (!active) return;
        setLeads(leadsRes.items);
        setClients(clientsRes.items);
      })
      .catch((err) => {
        toast.error("Could not load leads or clients", err instanceof Error ? err.message : undefined);
      })
      .finally(() => {
        if (active) setLoadingTargets(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  // Handle lead selection
  const handleLeadChange = (id: string) => {
    setSelectedLeadId(id);
    const lead = leads.find((l) => l.id === Number(id));
    if (lead) {
      setBusinessName(lead.business_name);
      setContactPerson(lead.contact_person || "");
      setPhone(lead.phone || "");
      setEmail(lead.email || "");
      setLocation(lead.location || "");
      updateTitleWithBusiness(lead.business_name, selectedTemplateKeys);
    }
    setErrors((prev) => ({ ...prev, target: "" }));
  };

  // Handle client selection
  const handleClientChange = (id: string) => {
    setSelectedClientId(id);
    const client = clients.find((c) => c.id === Number(id));
    if (client) {
      setBusinessName(client.business_name);
      setContactPerson(client.contact_person || "");
      setPhone(client.phone || "");
      setEmail(client.email || "");
      setLocation("");
      updateTitleWithBusiness(client.business_name, selectedTemplateKeys);
    }
    setErrors((prev) => ({ ...prev, target: "" }));
  };

  const updateTitleWithBusiness = (bName: string, keys: string[]) => {
    const templates = (meta?.proposal_templates ?? []).filter((t) => keys.includes(t.key));
    if (templates.length === 1) {
      setTitle(bName ? `${templates[0].title} — ${bName}` : templates[0].title);
    } else if (templates.length > 1) {
      setTitle(bName ? `Comprehensive Digital Solutions — ${bName}` : "Comprehensive Digital Solutions");
    }
  };

  // Toggle service template selection
  const toggleTemplate = (key: string) => {
    let next: string[];
    if (selectedTemplateKeys.includes(key)) {
      if (selectedTemplateKeys.length === 1) {
        toast.info("At least one service required", "Keep at least one service selected.");
        return;
      }
      next = selectedTemplateKeys.filter((k) => k !== key);
    } else {
      next = [...selectedTemplateKeys, key];
    }
    setSelectedTemplateKeys(next);
    rebuildContentFromTemplates(next, businessName);
  };

  // Rebuild content based on selected templates
  const rebuildContentFromTemplates = (keys: string[], bName: string) => {
    const templates = (meta?.proposal_templates ?? []).filter((t) => keys.includes(t.key));
    if (templates.length === 0) return;

    updateTitleWithBusiness(bName, keys);

    // Overviews
    const overviews = templates.map((t) =>
      t.overview.replace("{business}", bName || "the client's enterprise")
    );
    setOverview(overviews.join("\n\n"));

    // Combine scopes
    const combinedScope = Array.from(new Set(templates.flatMap((t) => t.scope)));
    setScopeItems(combinedScope);

    // Combine deliverables
    const combinedDeliverables = Array.from(new Set(templates.flatMap((t) => t.deliverables)));
    setDeliverables(combinedDeliverables);

    // Combine timeline
    const combinedTimeline = templates.flatMap((t) => t.timeline);
    setTimeline(combinedTimeline.length > 0 ? combinedTimeline : [
      { phase: "Phase 1: Discovery & Architecture", duration: "1 week" },
      { phase: "Phase 2: UI/UX Prototyping", duration: "1 week" },
      { phase: "Phase 3: Core Implementation", duration: "3 weeks" },
      { phase: "Phase 4: QA & Acceptance", duration: "1 week" },
    ]);

    // Build pricing rows
    const pricing: PricingRow[] = templates.map((t) => {
      let defaultRate = 50000;
      if (t.key === "website-development") defaultRate = 45000;
      else if (t.key === "web-application") defaultRate = 85000;
      else if (t.key === "custom-software") defaultRate = 120000;
      else if (t.key === "seo-services") defaultRate = 25000;
      else if (t.key === "digital-marketing") defaultRate = 35000;
      else if (t.key === "social-media") defaultRate = 28000;
      else if (t.key === "google-business-profile") defaultRate = 18000;
      else if (t.key === "custom-service") defaultRate = 50000;

      return {
        item: t.name,
        description: `Full implementation, configuration, QA and handover for ${bName || "Client"}`,
        qty: 1,
        rate: defaultRate,
        amount: defaultRate,
      };
    });
    setPricingRows(pricing);

    // Terms
    const combinedTerms = Array.from(new Set(templates.flatMap((t) => t.terms)));
    setTerms(
      combinedTerms.length > 0
        ? combinedTerms
        : [
            "Validity: This commercial proposal is valid for 30 calendar days from the date of issue.",
            "Payment Schedule: Invoices must be cleared within 7 calendar days of receipt.",
            "Intellectual Property: Full ownership transfers to the client upon final settlement.",
            "Warranty: 60 days of complimentary bug-fixing and technical support post-launch.",
          ]
    );
  };

  // Initial population from templates
  useEffect(() => {
    rebuildContentFromTemplates(selectedTemplateKeys, businessName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute pricing totals
  const totals = useMemo(() => {
    const subtotal = pricingRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const disc = Number(discount) || 0;
    const taxable = Math.max(subtotal - disc, 0);
    const tax = (taxable * (Number(taxRate) || 0)) / 100;
    const grandTotal = taxable + tax;
    return { subtotal, discount: disc, taxable, tax, grandTotal };
  }, [pricingRows, discount, taxRate]);

  const submitProposal = async (status: "draft" | "pending_approval" = "draft") => {
    const nextErrors: Record<string, string> = {};
    if (targetType === "lead" && !selectedLeadId) {
      nextErrors.target = "Select an existing lead or switch to Client.";
    }
    if (targetType === "client" && !selectedClientId) {
      nextErrors.target = "Select an existing client or switch to Lead.";
    }
    if (!title.trim()) nextErrors.title = "Proposal title is required.";
    if (pricingRows.length === 0) nextErrors.pricing = "At least one pricing item is required.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill required fields", "Review errors highlighted in red.");
      return;
    }

    setSaving(true);
    try {
      const validUntilDate = new Date(proposalDate);
      validUntilDate.setDate(validUntilDate.getDate() + (Number(validDays) || 30));

      const payloadContent = {
        overview,
        requirements: [],
        scope: scopeItems,
        deliverables,
        timeline,
        pricing: pricingRows,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax_rate: Number(taxRate) || 0,
        total: totals.grandTotal,
        payment_terms: paymentTerms,
        additional_costs: "Cloud hosting, third-party API tokens or domains are billed directly at cost.",
        terms,
        valid_until: validUntilDate.toISOString().split("T")[0],
        client_name: businessName,
        contact_person: contactPerson,
        client_email: email,
        client_phone: phone,
        client_location: location,
      };

      const primaryTemplate = meta?.proposal_templates.find((t) => t.key === selectedTemplateKeys[0]);
      const serviceType =
        selectedTemplateKeys.length === 1
          ? primaryTemplate?.service ?? "Digital Solutions"
          : "Full Stack Digital Suite";

      const proposal = await api.post<Proposal>("/proposals", {
        lead_id: targetType === "lead" ? Number(selectedLeadId) : undefined,
        client_id: targetType === "client" ? Number(selectedClientId) : undefined,
        title: title.trim(),
        service_type: serviceType,
        template_key: selectedTemplateKeys[0] || "custom-service",
        amount: totals.grandTotal,
        status,
        content: payloadContent,
      });

      toast.success(
        status === "pending_approval" ? "Submitted for Approval" : "Draft Created",
        `${proposal.code} · ${proposal.title}`
      );
      navigate(`/proposals/${proposal.id}/preview`);
    } catch (err) {
      toast.error("Could not save proposal", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Create Client Proposal"
        description="Choose a lead or client, select 1 or more verified service templates, and automatically build an A4 commercial proposal with instant PDF export."
        actions={
          <Link to="/proposals">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
              Back to proposals
            </Button>
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Main Creation Flow */}
        <div className="space-y-5">
          {/* STEP 1: Client Selection */}
          <Card>
            <CardHeader
              title="1. Client & Contact Information"
              subtitle="Select an existing lead or client to auto-populate contact details without duplicate manual entry"
            />
            <CardBody className="space-y-4">
              {/* Segmented Toggle: Lead vs Client */}
              <div className="flex rounded-lg border border-line bg-[#faf9fd] p-1 text-xs max-w-sm">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("lead");
                    setSelectedClientId("");
                  }}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded-md font-medium transition-all text-center flex items-center justify-center gap-1.5",
                    targetType === "lead"
                      ? "bg-white text-brand-700 shadow-sm font-semibold"
                      : "text-ink-600 hover:text-ink-900"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Prospective Lead
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("client");
                    setSelectedLeadId("");
                  }}
                  className={cn(
                    "flex-1 py-1.5 px-3 rounded-md font-medium transition-all text-center flex items-center justify-center gap-1.5",
                    targetType === "client"
                      ? "bg-white text-brand-700 shadow-sm font-semibold"
                      : "text-ink-600 hover:text-ink-900"
                  )}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Existing Client
                </button>
              </div>

              {targetType === "lead" ? (
                <Field label="Choose Lead" required error={errors.target}>
                  <Select
                    value={selectedLeadId}
                    onChange={(e) => handleLeadChange(e.target.value)}
                    invalid={Boolean(errors.target)}
                    disabled={loadingTargets}
                  >
                    <option value="">{loadingTargets ? "Loading leads…" : "Select a prospective lead"}</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.business_name} ({l.code}) — {l.contact_person || "No contact"} · {l.status}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Choose Client" required error={errors.target}>
                  <Select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    invalid={Boolean(errors.target)}
                    disabled={loadingTargets}
                  >
                    <option value="">{loadingTargets ? "Loading clients…" : "Select an active client"}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_name} ({c.code}) — {c.contact_person || "Client"}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              {/* Auto-populated Contact Grid */}
              <div className="grid gap-3.5 sm:grid-cols-2 pt-2 border-t border-line">
                <Field label="Business / Company Name">
                  <Input
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      updateTitleWithBusiness(e.target.value, selectedTemplateKeys);
                    }}
                    placeholder="e.g. CareFirst Health"
                  />
                </Field>
                <Field label="Contact Person Name">
                  <Input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Kumar"
                  />
                </Field>
                <Field label="Contact Phone">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </Field>
                <Field label="Contact Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@business.com"
                  />
                </Field>
                <Field label="Business Address / Location" className="sm:col-span-2">
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Cyber City, Hyderabad, India"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* STEP 2: Service Selection (All 8 Templates) */}
          <Card>
            <CardHeader
              title="2. Select Service Templates"
              subtitle="Pick 1 or multiple services. Scope, deliverables, and commercial rates combine automatically."
              action={
                <Badge tone="purple">
                  {selectedTemplateKeys.length} service{selectedTemplateKeys.length > 1 ? "s" : ""} selected
                </Badge>
              }
            />
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2">
                {(meta?.proposal_templates ?? []).map((t) => {
                  const isSelected = selectedTemplateKeys.includes(t.key);
                  return (
                    <div
                      key={t.key}
                      onClick={() => toggleTemplate(t.key)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3.5 transition-all text-left flex flex-col justify-between",
                        isSelected
                          ? "border-brand-500 bg-brand-50/50 shadow-sm ring-1 ring-brand-500"
                          : "border-line bg-white hover:border-brand-200 hover:bg-brand-50/20"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                              isSelected
                                ? "bg-brand-600 border-brand-600 text-white"
                                : "border-ink-300 bg-white"
                            )}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </span>
                          <span className="text-[10px] font-semibold text-brand-700 bg-brand-100/60 px-2 py-0.5 rounded-full">
                            {t.service}
                          </span>
                        </div>
                        <h4 className="mt-2 text-xs font-bold text-ink-900">{t.name}</h4>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-500">
                          {t.scope[0]}
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-[10.5px] text-ink-500">
                        <span>{t.deliverables.length} Deliverables</span>
                        <span>{t.timeline.length} Phases</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* STEP 3: Proposal Details & Content */}
          <Card>
            <CardHeader
              title="3. Proposal Specification & Scope"
              subtitle="Review and fine-tune title, executive overview, deliverables and timeline"
            />
            <CardBody className="space-y-4">
              <Field label="Proposal Title" required error={errors.title}>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  invalid={Boolean(errors.title)}
                  placeholder="e.g. Corporate Website Development — CareFirst Health"
                />
              </Field>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Proposal Date">
                  <Input
                    type="date"
                    value={proposalDate}
                    onChange={(e) => setProposalDate(e.target.value)}
                  />
                </Field>
                <Field label="Quote Validity (Days)">
                  <Input
                    type="number"
                    min="7"
                    max="90"
                    value={validDays}
                    onChange={(e) => setValidDays(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Executive Summary / Project Overview">
                <Textarea
                  rows={4}
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  placeholder="Comprehensive project overview explaining objectives and value proposition."
                />
              </Field>

              {/* Scope of Work */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-600">Scope of Work ({scopeItems.length} items)</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus className="h-3 w-3" />}
                    onClick={() => setScopeItems([...scopeItems, ""])}
                  >
                    Add Scope Line
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {scopeItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        value={item}
                        onChange={(e) => {
                          const next = [...scopeItems];
                          next[idx] = e.target.value;
                          setScopeItems(next);
                        }}
                        placeholder="Scope deliverable description"
                      />
                      <button
                        type="button"
                        onClick={() => setScopeItems(scopeItems.filter((_, i) => i !== idx))}
                        className="rounded p-2 text-ink-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* STEP 4: Commercials, Pricing & Payment Terms */}
          <Card>
            <CardHeader
              title="4. Commercials & Payment Terms"
              subtitle="Itemized pricing breakdown, tax calculation, and milestone payment schedules"
            />
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-700">Pricing Items</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus className="h-3 w-3" />}
                    onClick={() =>
                      setPricingRows([
                        ...pricingRows,
                        { item: "Additional Service", description: "", qty: 1, rate: 10000, amount: 10000 },
                      ])
                    }
                  >
                    Add Service Row
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#faf9fd] text-ink-600 font-semibold border-b border-line">
                      <tr>
                        <th className="p-2.5">Service / Item</th>
                        <th className="p-2.5 w-20 text-center">Qty</th>
                        <th className="p-2.5 w-32 text-right">Rate ({meta?.company.currency ?? "INR"})</th>
                        <th className="p-2.5 w-32 text-right">Amount</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {pricingRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <Input
                              value={row.item}
                              onChange={(e) => {
                                const next = [...pricingRows];
                                next[idx].item = e.target.value;
                                setPricingRows(next);
                              }}
                              placeholder="Item title"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="1"
                              value={row.qty}
                              onChange={(e) => {
                                const next = [...pricingRows];
                                const q = Math.max(Number(e.target.value) || 1, 1);
                                next[idx].qty = q;
                                next[idx].amount = q * next[idx].rate;
                                setPricingRows(next);
                              }}
                              className="text-center"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="500"
                              value={row.rate}
                              onChange={(e) => {
                                const next = [...pricingRows];
                                const r = Number(e.target.value) || 0;
                                next[idx].rate = r;
                                next[idx].amount = next[idx].qty * r;
                                setPricingRows(next);
                              }}
                              className="text-right"
                            />
                          </td>
                          <td className="p-2 text-right font-semibold tabular text-ink-900">
                            {formatCurrency(row.amount, meta?.company.currency)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => setPricingRows(pricingRows.filter((_, i) => i !== idx))}
                              className="rounded p-1 text-ink-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax & Discount Controls */}
              <div className="grid gap-3.5 sm:grid-cols-2 pt-2">
                <Field label={`Discount (${meta?.company.currency ?? "INR"})`}>
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Applicable Tax / GST (%)">
                  <Input
                    type="number"
                    min="0"
                    max="28"
                    step="1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="18"
                  />
                </Field>
              </div>

              {/* Payment Schedule */}
              <Field label="Payment Milestones & Terms">
                <Textarea
                  rows={3}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 50% Advance, 25% Interim Milestone, 25% Handover"
                />
              </Field>
            </CardBody>
          </Card>
        </div>

        {/* Sticky Sidebar: Summary & Actions */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardHeader
              title="Proposal Summary"
              subtitle="Commercial investment breakdown"
              action={<Badge tone="purple">Official A4 PDF</Badge>}
            />
            <CardBody className="space-y-4">
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-ink-600">
                  <span>Client:</span>
                  <span className="font-semibold text-ink-900 truncate max-w-[170px]">
                    {businessName || "Not selected"}
                  </span>
                </div>
                <div className="flex justify-between text-ink-600">
                  <span>Services:</span>
                  <span className="font-semibold text-ink-900">
                    {selectedTemplateKeys.length} Selected
                  </span>
                </div>
                <div className="flex justify-between text-ink-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold tabular text-ink-900">
                    {formatCurrency(totals.subtotal, meta?.company.currency)}
                  </span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span className="tabular">− {formatCurrency(totals.discount, meta?.company.currency)}</span>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between text-ink-600">
                    <span>Tax ({taxRate}%):</span>
                    <span className="font-semibold tabular text-ink-900">
                      {formatCurrency(totals.tax, meta?.company.currency)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-brand-200/80 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-brand-900">Grand Total:</span>
                  <span className="font-extrabold text-base text-brand-700 tabular">
                    {formatCurrency(totals.grandTotal, meta?.company.currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full justify-center"
                  loading={saving}
                  onClick={() => submitProposal("draft")}
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Save Draft & Preview PDF
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  loading={saving}
                  onClick={() => submitProposal("pending_approval")}
                  leftIcon={<Clock className="h-3.5 w-3.5 text-amber-600" />}
                >
                  Submit for Admin Approval
                </Button>
              </div>

              <div className="rounded-lg border border-line bg-[#fcfbfe] p-3 text-[11px] leading-relaxed text-ink-500">
                <p className="font-semibold text-ink-700 mb-1">Automatic PDF Generator:</p>
                Once created, you can immediately download the high-resolution ReportLab PDF or share it via WhatsApp and Email directly from the preview page.
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useMeta } from "../../context/MetaContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { cn, LEAD_STATUS_LABELS, SOURCE_LABELS, toDateTimeInput } from "../../lib/format";
import type { Lead } from "../../lib/types";
import { Button } from "../ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/Input";
import { Modal } from "../ui/Modal";

interface LeadFormState {
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  location: string;
  category: string;
  website: string;
  social_links: string;
  source: string;
  requirements: string;
  notes: string;
  status: string;
  assigned_staff_id: string;
  next_follow_up: string;
  services: number[];
}

const EMPTY: LeadFormState = {
  business_name: "",
  contact_person: "",
  phone: "",
  email: "",
  location: "",
  category: "",
  website: "",
  social_links: "",
  source: "",
  requirements: "",
  notes: "",
  status: "new",
  assigned_staff_id: "",
  next_follow_up: "",
  services: [],
};

export function LeadFormModal({
  open,
  onClose,
  lead,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
  onSaved: (lead: Lead) => void;
}) {
  const { meta } = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<LeadFormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        business_name: lead.business_name ?? "",
        contact_person: lead.contact_person ?? "",
        phone: lead.phone ?? "",
        email: lead.email ?? "",
        location: lead.location ?? "",
        category: lead.category ?? "",
        website: lead.website ?? "",
        social_links: lead.social_links ?? "",
        source: lead.source ?? "",
        requirements: lead.requirements ?? "",
        notes: lead.notes ?? "",
        status: lead.status,
        assigned_staff_id: lead.assigned_staff_id ? String(lead.assigned_staff_id) : "",
        next_follow_up: toDateTimeInput(lead.next_follow_up),
        services: lead.services.map((service) => service.id),
      });
    } else {
      setForm({
        ...EMPTY,
        assigned_staff_id:
          user?.role === "staff" ? String(user.id) : "",
      });
    }
    setErrors({});
  }, [open, lead, user]);

  const set = <K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.business_name.trim().length < 2) next.business_name = "Business name is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address.";
    if (form.phone && form.phone.replace(/\D/g, "").length < 7)
      next.phone = "Enter a valid phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        business_name: form.business_name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        location: form.location.trim() || null,
        category: form.category.trim() || null,
        website: form.website.trim() || null,
        social_links: form.social_links.trim() || null,
        source: form.source || null,
        requirements: form.requirements.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
        assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
        next_follow_up: form.next_follow_up || null,
        services: form.services,
      };
      const saved = lead
        ? await api.patch<Lead>(`/leads/${lead.id}`, payload)
        : await api.post<Lead>("/leads", payload);
      toast.success(
        lead ? "Lead updated" : "Lead added",
        `${saved.code} · ${saved.business_name}`
      );
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error("Could not save lead", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={lead ? `Edit ${lead.code}` : "Add a new lead"}
      description={
        lead
          ? "Update business details, qualification and assignment."
          : "A lead ID is generated automatically when the record is saved."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" loading={saving}>
            {lead ? "Save changes" : "Create lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
            Business details
          </p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Business name" required error={errors.business_name} className="sm:col-span-2">
              <Input
                value={form.business_name}
                onChange={(event) => set("business_name", event.target.value)}
                placeholder="e.g. Bright Smile Dental Studio"
                invalid={Boolean(errors.business_name)}
                autoFocus
              />
            </Field>
            <Field label="Contact person">
              <Input
                value={form.contact_person}
                onChange={(event) => set("contact_person", event.target.value)}
                placeholder="Full name"
              />
            </Field>
            <Field label="Phone number" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(event) => set("phone", event.target.value)}
                placeholder="+91 98450 00000"
                invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="contact@business.com"
                invalid={Boolean(errors.email)}
              />
            </Field>
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(event) => set("location", event.target.value)}
                placeholder="City"
              />
            </Field>
            <Field label="Business category">
              <Input
                value={form.category}
                onChange={(event) => set("category", event.target.value)}
                placeholder="e.g. Dental Clinic"
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(event) => set("website", event.target.value)}
                placeholder="www.business.com"
              />
            </Field>
            <Field label="Social media links" className="sm:col-span-2">
              <Input
                value={form.social_links}
                onChange={(event) => set("social_links", event.target.value)}
                placeholder="Instagram, Facebook or LinkedIn links"
              />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
            Qualification & ownership
          </p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Lead source">
              <Select value={form.source} onChange={(event) => set("source", event.target.value)}>
                <option value="">Select a source</option>
                {(meta?.lead_sources ?? Object.keys(SOURCE_LABELS)).map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source] ?? source}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned staff">
              <Select
                value={form.assigned_staff_id}
                onChange={(event) => set("assigned_staff_id", event.target.value)}
                disabled={user?.role !== "admin"}
              >
                <option value="">Unassigned</option>
                {(meta?.staff ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            {lead ? (
              <Field label="Lead status">
                <Select value={form.status} onChange={(event) => set("status", event.target.value)}>
                  {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field
              label="Next follow-up"
              hint="Optional. A follow-up record is created separately from a call."
            >
              <Input
                type="datetime-local"
                value={form.next_follow_up}
                onChange={(event) => set("next_follow_up", event.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Interested services"
            hint="Select every service the business has shown interest in."
            className="mt-3.5"
          >
            <div className="grid max-h-[168px] gap-1 overflow-y-auto rounded-lg border border-line p-2.5 sm:grid-cols-2">
              {(meta?.services ?? []).map((service) => (
                <Checkbox
                  key={service.id}
                  label={service.name}
                  checked={form.services.includes(service.id)}
                  onChange={(event) =>
                    set(
                      "services",
                      event.target.checked
                        ? [...form.services, service.id]
                        : form.services.filter((id) => id !== service.id)
                    )
                  }
                  className={cn(
                    "rounded-md px-2 py-1.5 hover:bg-brand-50/60",
                    form.services.includes(service.id) && "bg-brand-50/70"
                  )}
                />
              ))}
            </div>
          </Field>
        </div>

        <div className="grid gap-3.5">
          <Field label="Requirements">
            <Textarea
              value={form.requirements}
              onChange={(event) => set("requirements", event.target.value)}
              placeholder="What is the business looking for? Note scope, budget or timeline details."
              rows={3}
            />
          </Field>
          <Field label="Internal notes">
            <Textarea
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Notes visible to the team only."
              rows={2}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { useMeta } from "../../context/MetaContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { CALL_OUTCOME_LABELS, toDateTimeInput } from "../../lib/format";
import type { CallRecord, Lead, Paginated } from "../../lib/types";
import { Button } from "../ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/Input";
import { Modal } from "../ui/Modal";

const OUTCOME_HINTS: Record<string, string> = {
  interested: "The lead is interested and wants to continue the conversation.",
  not_interested: "The lead is not interested at this time.",
  not_taken: "The call was not answered. The lead is not duplicated.",
  call_back_requested: "The lead asked to be contacted again later.",
  accepted: "The lead has accepted and is ready to move forward.",
  proposal_required: "A proposal should be prepared for this lead.",
  do_not_contact: "Stop all future outreach for this business.",
};

export function RecordCallModal({
  open,
  onClose,
  leadId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  leadId?: number | null;
  onSaved?: () => void;
}) {
  const { meta } = useMeta();
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [form, setForm] = useState({
    lead_id: "",
    called_at: toDateTimeInput(new Date().toISOString()),
    outcome: "",
    notes: "",
    next_follow_up: "",
    create_follow_up: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      lead_id: leadId ? String(leadId) : "",
      called_at: toDateTimeInput(new Date().toISOString()),
      outcome: "",
      notes: "",
      next_follow_up: "",
      create_follow_up: true,
    });
    setErrors({});
    let active = true;
    setLoadingLeads(true);
    api
      .get<Paginated<Lead>>("/leads", { page_size: 100, sort: "business" })
      .then((data) => {
        if (active) setLeads(data.items);
      })
      .catch(() => {
        if (active) setLeads([]);
      })
      .finally(() => {
        if (active) setLoadingLeads(false);
      });
    return () => {
      active = false;
    };
  }, [open, leadId]);

  const selectedLead = leads.find((lead) => lead.id === Number(form.lead_id));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.lead_id) next.lead_id = "Select the lead this call belongs to.";
    if (!form.outcome) next.outcome = "Select a call outcome.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const call = await api.post<CallRecord>("/calls", {
        lead_id: Number(form.lead_id),
        called_at: form.called_at || null,
        outcome: form.outcome,
        notes: form.notes.trim() || null,
        next_follow_up: form.next_follow_up || null,
        create_follow_up: form.create_follow_up,
      });
      toast.success(
        "Call recorded",
        `${call.code} · ${call.business_name ?? "Lead"} — ${
          CALL_OUTCOME_LABELS[call.outcome] ?? call.outcome
        }`
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error("Could not record call", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a call"
      description="Each call is saved as a separate activity. The lead is never duplicated."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="call-form" loading={saving}>
            Save call record
          </Button>
        </>
      }
    >
      <form id="call-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Lead / business" required error={errors.lead_id}>
          <Select
            value={form.lead_id}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, lead_id: event.target.value }));
              setErrors((prev) => ({ ...prev, lead_id: "" }));
            }}
            invalid={Boolean(errors.lead_id)}
            disabled={loadingLeads}
          >
            <option value="">{loadingLeads ? "Loading leads…" : "Select a lead"}</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.business_name} · {lead.code}
              </option>
            ))}
          </Select>
        </Field>

        {selectedLead ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[#fbf9ff] px-3 py-2 text-[11px] text-ink-500">
            <span>{selectedLead.contact_person ?? "No contact person"}</span>
            <span>{selectedLead.phone ?? "No phone"}</span>
            <span>Owner: {selectedLead.assigned_staff?.name ?? "Unassigned"}</span>
          </div>
        ) : null}

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Call date & time">
            <Input
              type="datetime-local"
              value={form.called_at}
              onChange={(event) => setForm((prev) => ({ ...prev, called_at: event.target.value }))}
            />
          </Field>
          <Field label="Call outcome" required error={errors.outcome}>
            <Select
              value={form.outcome}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, outcome: event.target.value }));
                setErrors((prev) => ({ ...prev, outcome: "" }));
              }}
              invalid={Boolean(errors.outcome)}
            >
              <option value="">Select an outcome</option>
              {(meta?.call_outcomes ?? Object.keys(CALL_OUTCOME_LABELS)).map((outcome) => (
                <option key={outcome} value={outcome}>
                  {CALL_OUTCOME_LABELS[outcome] ?? outcome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {form.outcome ? (
          <p className="-mt-1 rounded-md bg-brand-50/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-brand-700">
            {OUTCOME_HINTS[form.outcome]}
          </p>
        ) : null}

        <Field label="Call notes">
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="What was discussed? Note objections, budget or next steps."
            rows={3}
          />
        </Field>

        <div className="rounded-lg border border-line p-3">
          <Field label="Next follow-up" hint="Optional. Choose when the team should reconnect.">
            <Input
              type="datetime-local"
              value={form.next_follow_up}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, next_follow_up: event.target.value }))
              }
            />
          </Field>
          {form.next_follow_up ? (
            <Checkbox
              className="mt-2"
              label="Create a follow-up record automatically"
              description="It will appear in the assignee's follow-up list."
              checked={form.create_follow_up}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, create_follow_up: event.target.checked }))
              }
            />
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

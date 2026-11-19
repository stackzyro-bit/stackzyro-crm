import { useEffect, useMemo, useState, type FormEvent } from "react";
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

const ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

export function RecordCallModal({
  open,
  onClose,
  leadId,
  callRecord,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  leadId?: number | null;
  callRecord?: CallRecord | null;
  onSaved?: () => void;
}) {
  const { meta } = useMeta();
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadFilter, setLeadFilter] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
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
    const effectiveLeadId = callRecord?.lead_id ?? leadId;
    setForm({
      lead_id: effectiveLeadId ? String(effectiveLeadId) : "",
      called_at: callRecord
        ? toDateTimeInput(callRecord.called_at)
        : toDateTimeInput(new Date().toISOString()),
      outcome: callRecord?.outcome ?? "",
      notes: callRecord?.notes ?? "",
      next_follow_up: callRecord?.next_follow_up
        ? toDateTimeInput(callRecord.next_follow_up)
        : "",
      create_follow_up: !callRecord,
    });
    setLeadFilter("");
    setSelectedLetter(null);
    setErrors({});
    let active = true;
    setLoadingLeads(true);

    const loadOptions = api
      .get<Lead[]>("/leads/options")
      .catch(() =>
        api
          .get<Paginated<Lead>>("/leads", { page_size: 500, sort: "business" })
          .then((d) => d.items)
      );

    const loadPreset = effectiveLeadId
      ? api.get<Lead>(`/leads/${effectiveLeadId}`).catch(() => null)
      : Promise.resolve(null);

    Promise.all([loadOptions, loadPreset])
      .then(([allLeads, presetLead]) => {
        if (!active) return;
        let list = allLeads || [];
        if (presetLead && !list.some((l) => l.id === presetLead.id)) {
          list = [presetLead, ...list];
        }
        setLeads(list);
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
  }, [open, leadId, callRecord]);

  const selectedLead = leads.find((lead) => lead.id === Number(form.lead_id));

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const name = (lead.business_name || "").trim();
      if (!name) continue;
      const char = name.charAt(0).toUpperCase();
      if (char >= "A" && char <= "Z") {
        counts[char] = (counts[char] || 0) + 1;
      }
    }
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const name = (l.business_name || "").trim();
      const firstChar = name.charAt(0).toUpperCase();

      if (selectedLetter && firstChar !== selectedLetter) {
        return false;
      }

      if (leadFilter.trim()) {
        const q = leadFilter.toLowerCase().trim();
        const matchesName = name.toLowerCase().includes(q);
        const matchesCode = (l.code || "").toLowerCase().includes(q);
        const matchesContact = (l.contact_person || "").toLowerCase().includes(q);
        const matchesPhone = (l.phone || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesContact && !matchesPhone) {
          return false;
        }
      }

      return true;
    });
  }, [leads, selectedLetter, leadFilter]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.lead_id) next.lead_id = "Select the lead this call belongs to.";
    if (!form.outcome) next.outcome = "Select a call outcome.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      if (callRecord) {
        const updated = await api.patch<CallRecord>(`/calls/${callRecord.id}`, {
          called_at: form.called_at || null,
          outcome: form.outcome,
          notes: form.notes.trim() || null,
          next_follow_up: form.next_follow_up || null,
        });
        toast.success(
          "Call record updated",
          `${updated.code} · ${updated.business_name ?? "Lead"} — ${
            CALL_OUTCOME_LABELS[updated.outcome] ?? updated.outcome
          }`
        );
      } else {
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
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(
        callRecord ? "Could not update call record" : "Could not record call",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={callRecord ? `Edit call ${callRecord.code}` : "Record a call"}
      description={
        callRecord
          ? `Update conversation details for ${callRecord.business_name ?? "this lead"}.`
          : "Each call is saved as a separate activity. The lead is never duplicated."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="call-form" loading={saving}>
            {callRecord ? "Save changes" : "Save call record"}
          </Button>
        </>
      }
    >
      <form id="call-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Field label="Lead / business" required error={errors.lead_id}>
            {!callRecord && leads.length > 8 ? (
              <Input
                type="text"
                placeholder="Type to filter leads (e.g. Zaira, Vintage, LD-0170)…"
                value={leadFilter}
                onChange={(event) => setLeadFilter(event.target.value)}
                className="mb-1.5 text-[12px]"
              />
            ) : null}
            <Select
              value={form.lead_id}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, lead_id: event.target.value }));
                setErrors((prev) => ({ ...prev, lead_id: "" }));
              }}
              invalid={Boolean(errors.lead_id)}
              disabled={loadingLeads || Boolean(callRecord)}
            >
              <option value="">
                {loadingLeads
                  ? "Loading leads…"
                  : filteredLeads.length === 0
                  ? selectedLetter
                    ? `No leads found under letter "${selectedLetter}"`
                    : "No matching leads found"
                  : selectedLetter
                  ? `Select a lead under letter "${selectedLetter}" (${filteredLeads.length} available)`
                  : "Select a lead"}
              </option>
              {form.lead_id &&
              selectedLead &&
              !filteredLeads.some((l) => l.id === selectedLead.id) ? (
                <option value={selectedLead.id}>
                  {selectedLead.business_name} · {selectedLead.code} (Selected)
                </option>
              ) : null}
              {filteredLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.business_name} · {lead.code}
                </option>
              ))}
            </Select>
          </Field>

          {!callRecord ? (
            <div className="mt-2.5 rounded-lg border border-line bg-slate-50/60 p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink-700">Filter by letter (A–Z):</span>
                  {selectedLetter ? (
                    <span className="inline-flex items-center gap-1 rounded bg-brand-100 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800">
                      Letter "{selectedLetter}"
                      <button
                        type="button"
                        onClick={() => setSelectedLetter(null)}
                        className="ml-0.5 text-brand-600 hover:text-brand-900"
                        title="Clear letter filter"
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] text-ink-400">
                  Showing {filteredLeads.length} of {leads.length} available leads
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedLetter(null)}
                  className={`rounded border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    selectedLetter === null
                      ? "border-brand-600 bg-brand-600 text-white shadow-xs"
                      : "border-line bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  }`}
                  title="Show all leads"
                >
                  All
                </button>
                {ALPHABET.map((char) => {
                  const count = letterCounts[char] || 0;
                  const isSelected = selectedLetter === char;
                  const hasLeads = count > 0;
                  return (
                    <button
                      key={char}
                      type="button"
                      onClick={() => setSelectedLetter(isSelected ? null : char)}
                      className={`min-w-[24px] rounded border px-1 py-0.5 text-center text-[11px] font-medium transition-colors ${
                        isSelected
                          ? "border-brand-600 bg-brand-600 font-bold text-white shadow-xs"
                          : hasLeads
                          ? "border-line bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                          : "border-slate-200/60 bg-slate-100/50 text-ink-300 hover:bg-slate-200/50 hover:text-ink-500"
                      }`}
                      title={`${char}: ${count} lead${count === 1 ? "" : "s"}`}
                    >
                      {char}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : leads.length > 0 ? (
            <p className="mt-1 text-[10px] text-ink-400">
              Showing {filteredLeads.length} of {leads.length} available leads
            </p>
          ) : null}
        </div>

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
          {!callRecord && form.next_follow_up ? (
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

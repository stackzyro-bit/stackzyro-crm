import { Eye, PhoneCall, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecordCallModal } from "../components/calls/RecordCallModal";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { ActionMenu } from "../components/ui/ActionMenu";
import { Avatar } from "../components/ui/Avatar";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Column, DataTable, Pagination } from "../components/ui/DataTable";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Field, Input, Select } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import {
  CALL_OUTCOME_LABELS,
  formatDate,
  formatDateTime,
  formatTime,
  labelFor,
} from "../lib/format";
import type { CallRecord, Paginated } from "../lib/types";

const PAGE_SIZE = 10;

type CallPage = Paginated<CallRecord> & { outcome_summary: Record<string, number> };

const SUMMARY_CARDS = [
  { key: "total", label: "Total calls" },
  { key: "not_taken", label: "Not taken" },
  { key: "interested", label: "Interested" },
  { key: "accepted", label: "Accepted" },
];

export function Calls() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [staffId, setStaffId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<CallPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [presetLeadId, setPresetLeadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CallRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CallRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setPresetLeadId(searchParams.get("lead") ? Number(searchParams.get("lead")) : null);
      setModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      const payload = await api.get<CallPage>("/calls", {
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
        outcome: outcome === "all" ? undefined : outcome,
        staff_id: staffId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load calls", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, outcome, staffId, dateFrom, dateTo, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeModal = () => {
    setModalOpen(false);
    setPresetLeadId(null);
    if (searchParams.get("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      next.delete("lead");
      setSearchParams(next, { replace: true });
    }
  };

  const summary = data?.outcome_summary ?? {};
  const totalRecorded = Object.values(summary).reduce((sum, value) => sum + value, 0);

  const deleteCall = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/calls/${deleteTarget.id}`);
      toast.success("Call record deleted", deleteTarget.code);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error("Could not delete call", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<CallRecord>[] = [
    {
      key: "code",
      header: "Call ID",
      render: (call) => (
        <span className="whitespace-nowrap text-[11px] font-medium tabular text-ink-400">
          {call.code}
        </span>
      ),
    },
    {
      key: "lead_code",
      header: "Lead ID",
      render: (call) => (
        <span className="whitespace-nowrap text-[11px] tabular text-ink-400">{call.lead_code}</span>
      ),
    },
    {
      key: "business",
      header: "Business name",
      render: (call) => (
        <span className="whitespace-nowrap text-[12.5px] font-semibold text-ink-900">
          {call.business_name}
        </span>
      ),
    },
    {
      key: "staff",
      header: "Staff name",
      render: (call) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={call.staff?.name} size="xs" />
          <span className="text-[11.5px] text-ink-600">{call.staff?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "date",
      header: "Call date",
      render: (call) => (
        <span className="whitespace-nowrap text-[11.5px] text-ink-600">
          {formatDate(call.called_at)}
        </span>
      ),
    },
    {
      key: "time",
      header: "Call time",
      render: (call) => (
        <span className="whitespace-nowrap text-[11.5px] tabular text-ink-600">
          {formatTime(call.called_at)}
        </span>
      ),
    },
    {
      key: "outcome",
      header: "Outcome",
      render: (call) => <StatusBadge value={call.outcome} labels={CALL_OUTCOME_LABELS} />,
    },
    {
      key: "notes",
      header: "Call notes",
      render: (call) => (
        <p className="line-clamp-2 max-w-[210px] text-[11px] leading-relaxed text-ink-500">
          {call.notes ?? "—"}
        </p>
      ),
    },
    {
      key: "next",
      header: "Next follow-up",
      render: (call) => (
        <span className="whitespace-nowrap text-[11px] text-ink-500">
          {call.next_follow_up ? formatDateTime(call.next_follow_up) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (call) => (
        <ActionMenu
          actions={[
            { label: "View details", icon: Eye, onClick: () => setDetail(call) },
            {
              label: "Delete call",
              icon: Trash2,
              danger: true,
              hidden: user?.role !== "admin",
              onClick: () => setDeleteTarget(call),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Call management"
        description="Every conversation is saved as its own activity against the lead. Calling the same business again never creates a duplicate lead."
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="calls" label="Call Guide" />
            <Button
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setPresetLeadId(null);
                setModalOpen(true);
              }}
            >
              Record call
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.key} className="p-4">
            <p className="text-[11px] font-medium text-ink-500">{card.label}</p>
            <p className="mt-2 text-xl font-semibold tabular text-ink-900">
              {card.key === "total" ? totalRecorded : summary[card.key] ?? 0}
            </p>
            <p className="mt-1 text-[10px] text-ink-400">Across all recorded calls</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardBody className="py-3.5">
          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Search" className="min-w-[200px] flex-1">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Business, call ID or lead ID"
              />
            </Field>
            <Field label="Outcome" className="w-[180px]">
              <Select
                value={outcome}
                onChange={(event) => {
                  setOutcome(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All outcomes</option>
                {Object.entries(CALL_OUTCOME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {user?.role === "admin" ? (
              <Field label="Staff" className="w-[160px]">
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
            {search || outcome !== "all" || staffId || dateFrom || dateTo ? (
              <Button
                variant="ghost"
                size="sm"
                className="mb-0.5"
                onClick={() => {
                  setSearch("");
                  setOutcome("all");
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
          title="Call log"
          subtitle="Multiple calls per lead are kept as separate records"
          action={<Badge tone="purple">{data?.total ?? 0} calls</Badge>}
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(call) => call.id}
          loading={loading}
          minWidth="1200px"
          emptyIcon={PhoneCall}
          emptyTitle="No calls recorded"
          emptyDescription="Record your first call to build a complete conversation history for each lead."
          emptyAction={
            <Button
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setModalOpen(true)}
            >
              Record call
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

      <RecordCallModal
        open={modalOpen}
        onClose={closeModal}
        leadId={presetLeadId}
        onSaved={() => void load()}
      />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Call ${detail.code}` : "Call details"}
        description={detail ? `${detail.business_name} · ${detail.lead_code}` : undefined}
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={detail.outcome} labels={CALL_OUTCOME_LABELS} />
              <Badge tone="grey">{formatDateTime(detail.called_at)}</Badge>
              <Badge tone="blue">{detail.staff?.name ?? "Unassigned"}</Badge>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-600">
                {detail.notes ?? "No notes were recorded for this call."}
              </p>
            </div>
            <div className="rounded-lg bg-[#fbf9ff] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                Next follow-up
              </p>
              <p className="mt-1 text-[12.5px] font-medium text-ink-700">
                {detail.next_follow_up ? formatDateTime(detail.next_follow_up) : "Not scheduled"}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteCall}
        loading={busy}
        title="Delete this call record?"
        description={`${deleteTarget?.code ?? ""} will be removed from reporting. This cannot be undone.`}
        confirmLabel="Delete call"
      />
    </div>
  );
}

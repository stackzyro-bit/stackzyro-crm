import { Download, FileDown, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Field, Input } from "../components/ui/Input";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api, downloadFile } from "../lib/api";
import {
  CALL_OUTCOME_LABELS,
  SOURCE_LABELS,
  formatDate,
  formatDateTime,
  labelFor,
} from "../lib/format";
import type { ReportData, ReportStaffRow } from "../lib/types";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];

function MetricRow({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-0">
      <div>
        <p className="text-[11.5px] text-ink-600">{label}</p>
        {hint ? <p className="text-[9.5px] text-ink-400">{hint}</p> : null}
      </div>
      <p className="text-[13px] font-semibold tabular text-ink-900">{value}</p>
    </div>
  );
}

export function Reports() {
  const { meta } = useMeta();
  const toast = useToast();
  const [preset, setPreset] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.get<ReportData>("/reports", {
        preset,
        date_from: preset === "custom" ? dateFrom || undefined : undefined,
        date_to: preset === "custom" ? dateTo || undefined : undefined,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load reports", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [preset, dateFrom, dateTo, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(
        "/reports/export.csv",
        {
          preset,
          date_from: preset === "custom" ? dateFrom || undefined : undefined,
          date_to: preset === "custom" ? dateTo || undefined : undefined,
        },
        "stackzyro-report.csv"
      );
      toast.success("Report exported", "The CSV includes lead, call, proposal and staff sections.");
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const staffColumns: Column<ReportStaffRow>[] = [
    {
      key: "name",
      header: "Staff",
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="text-[12px] font-semibold text-ink-900">{row.name}</p>
          <p className="text-[10px] text-ink-400">{row.designation ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "leads",
      header: "Leads",
      align: "right",
      render: (row) => <span className="tabular">{row.leads}</span>,
    },
    {
      key: "calls",
      header: "Calls",
      align: "right",
      render: (row) => <span className="tabular">{row.calls}</span>,
    },
    {
      key: "interested",
      header: "Interested",
      align: "right",
      render: (row) => <span className="tabular text-emerald-700">{row.interested}</span>,
    },
    {
      key: "not_taken",
      header: "Not taken",
      align: "right",
      render: (row) => <span className="tabular text-amber-700">{row.not_taken}</span>,
    },
    {
      key: "accepted",
      header: "Accepted",
      align: "right",
      render: (row) => <span className="tabular text-teal-700">{row.accepted}</span>,
    },
    {
      key: "followups",
      header: "Follow-ups",
      align: "right",
      render: (row) => (
        <span className="whitespace-nowrap tabular">
          {row.followups_completed}/{row.followups_total}
          <span className="ml-1 text-[10px] text-ink-400">({row.followup_rate}%)</span>
        </span>
      ),
    },
    {
      key: "present",
      header: "Present days",
      align: "right",
      render: (row) => <span className="tabular">{row.present_days}</span>,
    },
  ];

  const maxSource = Math.max(...(data?.sources.map((source) => source.count) ?? [1]), 1);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Lead, call, proposal, attendance and staff performance figures for the selected period — calculated separately from live records."
        actions={
          <>
            <ModuleHelpButton moduleKey="reports" label="Report Guide" />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={exportCsv}
              loading={exporting}
              className="no-print"
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              leftIcon={<Printer className="h-3.5 w-3.5" />}
              onClick={() => {
                toast.info("Print report", "Choose “Save as PDF” to archive this report.");
                window.setTimeout(() => window.print(), 200);
              }}
              className="no-print"
            >
              Print / PDF
            </Button>
          </>
        }
      />

      <Card className="no-print mb-4">
        <CardBody className="py-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPreset(item.key)}
                  className={`rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                    preset === item.key
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-[#f5f2fb] text-ink-500 hover:text-brand-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {preset === "custom" ? (
              <>
                <Field label="From" className="w-[145px]">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </Field>
                <Field label="To" className="w-[145px]">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </Field>
              </>
            ) : null}
            <p className="mb-1 ml-auto text-[10.5px] text-ink-400">
              {data ? `${formatDate(data.date_from)} – ${formatDate(data.date_to)}` : "Loading period…"}
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3 shadow-card">
        <div>
          <p className="text-[13px] font-semibold text-ink-900">
            {meta?.company.name ?? "STACKZYRO"} · {data?.label ?? "Report"}
          </p>
          <p className="text-[10.5px] text-ink-400">
            {data ? `${formatDate(data.date_from)} to ${formatDate(data.date_to)}` : ""} · Generated{" "}
            {data ? formatDateTime(data.generated_at) : ""}
          </p>
        </div>
        <Badge tone="purple">Live database report</Badge>
      </div>

      {loading || !data ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-4 w-1/2" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader title="Lead report" subtitle="Created in the selected period" />
              <CardBody className="py-2">
                <MetricRow label="Total leads" value={data.leads.total} />
                <MetricRow label="New leads" value={data.leads.new} />
                <MetricRow label="Interested" value={data.leads.interested} />
                <MetricRow label="Not interested" value={data.leads.not_interested} />
                <MetricRow label="Accepted" value={data.leads.accepted} />
                <MetricRow label="Converted" value={data.leads.converted} />
                <MetricRow label="Conversion rate" value={`${data.leads.conversion_rate}%`} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Call report" subtitle="Each call counted separately" />
              <CardBody className="py-2">
                <MetricRow label="Total calls" value={data.calls.total} />
                <MetricRow label="Answered" value={data.calls.answered} />
                <MetricRow label="Not taken" value={data.calls.not_taken} />
                <MetricRow label="Interested" value={data.calls.interested} />
                <MetricRow label="Not interested" value={data.calls.not_interested} />
                <MetricRow label="Accepted" value={data.calls.accepted} />
                <MetricRow label="Call back requested" value={data.calls.call_back_requested} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Proposal report" subtitle="Drafted and decided in period" />
              <CardBody className="py-2">
                <MetricRow label="Proposals required" value={data.proposals.required} />
                <MetricRow label="Drafted" value={data.proposals.drafted} />
                <MetricRow label="Pending approval" value={data.proposals.pending} />
                <MetricRow label="Sent" value={data.proposals.sent} />
                <MetricRow label="Accepted" value={data.proposals.accepted} />
                <MetricRow label="Rejected" value={data.proposals.rejected} />
                <MetricRow label="Expired" value={data.proposals.expired} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Attendance & follow-ups" subtitle="Team activity summary" />
              <CardBody className="py-2">
                <MetricRow label="Present days" value={data.attendance.present} />
                <MetricRow label="Absent" value={data.attendance.absent} />
                <MetricRow label="On leave" value={data.attendance.leave} />
                <MetricRow label="Attendance records" value={data.attendance.records} />
                <MetricRow label="Follow-ups scheduled" value={data.followups.total} />
                <MetricRow label="Follow-ups completed" value={data.followups.completed} />
                <MetricRow label="Completion rate" value={`${data.followups.completion_rate}%`} />
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Staff performance"
                subtitle="Staff-wise leads, calls, outcomes, attendance and follow-up completion"
                action={<Badge tone="grey">{data.staff.length} staff</Badge>}
              />
              <DataTable
                columns={staffColumns}
                rows={data.staff}
                rowKey={(row) => row.staff_id}
                minWidth="880px"
                emptyTitle="No staff activity in this period"
                emptyDescription="Try a wider date range to see staff performance."
              />
            </Card>

            <Card>
              <CardHeader title="Lead sources" subtitle="Where enquiries came from" />
              <CardBody className="space-y-3">
                {data.sources.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-ink-400">
                    No leads were created in this period.
                  </p>
                ) : (
                  data.sources.map((source) => (
                    <div key={source.source}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-600">
                          {SOURCE_LABELS[source.source] ?? source.source}
                        </span>
                        <span className="font-semibold tabular text-ink-800">{source.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f3f0f9]">
                        <div
                          className="h-full rounded-full bg-brand-400"
                          style={{ width: `${(source.count / maxSource) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
                <div className="border-t border-line pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    Call outcome split
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(CALL_OUTCOME_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between text-[10.5px]">
                        <span className="text-ink-500">{labelFor(CALL_OUTCOME_LABELS, label)}</span>
                        <span className="tabular text-ink-700">{data.calls.by_outcome[key] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[10.5px] text-ink-400">
            <FileDown className="h-3.5 w-3.5" />
            Total leads ({data.leads.total}) and total calls ({data.calls.total}) are counted from
            separate tables. Repeat calls to the same business count as multiple calls but a single
            unique lead.
          </div>
        </>
      )}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn, formatNumber, type Tone } from "../../lib/format";
import { Card } from "./Card";
import { Skeleton } from "./Skeleton";

const TONES: Record<Tone, string> = {
  purple: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-rose-50 text-rose-600",
  blue: "bg-sky-50 text-sky-600",
  grey: "bg-slate-100 text-slate-500",
  teal: "bg-teal-50 text-teal-600",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "purple",
  footnote,
  loading = false,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: Tone;
  footnote?: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="mt-4 h-6 w-12" />
        <Skeleton className="mt-2 h-2 w-24" />
      </Card>
    );
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium leading-4 text-ink-500">{label}</p>
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-3 text-[22px] font-semibold leading-none tracking-tight text-ink-900 tabular">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <p className="mt-1.5 min-h-[14px] text-[10.5px] text-ink-400">{footnote ?? "\u00A0"}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-line bg-white p-4 text-left shadow-card transition-all duration-150 hover:-translate-y-px hover:border-brand-200 hover:shadow-pop"
      >
        {content}
      </button>
    );
  }

  return <Card className="p-4">{content}</Card>;
}

import type { ReactNode } from "react";
import { cn, labelFor, statusTone, type Tone } from "../../lib/format";

const TONES: Record<Tone, string> = {
  purple: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  grey: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

const DOTS: Record<Tone, string> = {
  purple: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  grey: "bg-slate-400",
  blue: "bg-sky-500",
  teal: "bg-teal-500",
};

export function Badge({
  children,
  tone = "purple",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({
  value,
  labels,
  tone,
}: {
  value: string | null | undefined;
  labels: Record<string, string>;
  tone?: Tone;
}) {
  return (
    <Badge tone={tone ?? statusTone(value)} dot>
      {labelFor(labels, value)}
    </Badge>
  );
}

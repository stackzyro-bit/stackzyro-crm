import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/format";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-[13px] font-semibold text-ink-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

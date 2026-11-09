import type { ReactNode } from "react";
import { cn } from "../../lib/format";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

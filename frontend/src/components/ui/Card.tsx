import type { ReactNode } from "react";
import { cn } from "../../lib/format";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-line bg-white shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4",
        className
      )}
    >
      {children ? (
        children
      ) : (
        <>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-ink-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </>
      )}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

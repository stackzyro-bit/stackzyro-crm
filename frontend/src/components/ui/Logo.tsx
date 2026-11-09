import { Layers3 } from "lucide-react";
import { cn } from "../../lib/format";

interface LogoProps {
  collapsed?: boolean;
  light?: boolean;
  className?: string;
}

export function Logo({ collapsed = false, light = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
          light ? "bg-white/15 text-white" : "bg-brand-600 text-white shadow-sm"
        )}
      >
        <Layers3 className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p
            className={cn(
              "text-[14px] font-semibold tracking-[0.09em]",
              light ? "text-white" : "text-ink-900"
            )}
          >
            STACKZYRO
          </p>
          <p
            className={cn(
              "truncate text-[10px] tracking-[0.01em]",
              light ? "text-white/70" : "text-ink-400"
            )}
          >
            Turning Ideas Into Digital Solutions
          </p>
        </div>
      ) : null}
    </div>
  );
}

import { cn, initials } from "../../lib/format";

interface AvatarProps {
  name: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-11 w-11 text-sm",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ring-1 ring-inset ring-brand-200/60",
        SIZES[size],
        className
      )}
      title={name ?? undefined}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

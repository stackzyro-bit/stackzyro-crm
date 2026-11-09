import { ChevronDown } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/format";

export const controlClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-400";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-xs font-medium text-ink-600">
          {label}
          {required ? <span className="text-rose-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        controlClass,
        invalid && "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        controlClass,
        "min-h-[84px] resize-y leading-relaxed",
        invalid && "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlClass,
          "cursor-pointer appearance-none pr-9",
          invalid && "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
          className
        )}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent py-0.5 text-[13px] text-ink-700",
        className
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 rounded border-line text-brand-600 accent-brand-600"
        {...props}
      />
      <span className="min-w-0">
        <span className="block leading-5">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

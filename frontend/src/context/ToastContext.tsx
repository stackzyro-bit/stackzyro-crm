import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../lib/format";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white text-ink-900",
  error: "border-rose-200 bg-white text-ink-900",
  info: "border-brand-200 bg-white text-ink-900",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "text-emerald-600",
  error: "text-rose-600",
  info: "text-brand-600",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { id, type, title, message }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, message) => toast("success", title, message),
      error: (title, message) => toast("error", title, message),
      info: (title, message) => toast("info", title, message),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-end gap-2 px-4 sm:right-6 sm:left-auto sm:px-0"
      >
        {items.map((item) => {
          const Icon = ICONS[item.type];
          return (
            <div
              key={item.id}
              className={cn(
                "pop-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-pop",
                STYLES[item.type]
              )}
              role="status"
            >
              <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", ICON_STYLES[item.type])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.message ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{item.message}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

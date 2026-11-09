import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/format";

export interface MenuAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
  disabled?: boolean;
}

export function ActionMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visible = actions.filter((action) => !action.hidden);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = 192;
      const height = Math.min(visible.length * 36 + 8, 340);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const top =
        rect.bottom + height + 8 > window.innerHeight
          ? Math.max(8, rect.top - height - 6)
          : rect.bottom + 6;
      setCoords({ top, left });
    }
    setOpen((value) => !value);
  };

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        aria-label="Open actions"
        aria-expanded={open}
        className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: coords.top, left: coords.left }}
              className="pop-enter fixed z-[95] w-48 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-pop"
              onClick={(event) => event.stopPropagation()}
            >
              {visible.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => {
                      setOpen(false);
                      action.onClick();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      action.danger
                        ? "text-rose-600 hover:bg-rose-50"
                        : "text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                    )}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                    {action.label}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

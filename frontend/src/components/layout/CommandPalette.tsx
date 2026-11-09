import {
  ArrowRight,
  BookOpen,
  CalendarPlus,
  FilePlus2,
  HelpCircle,
  PhoneCall,
  Search,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/format";
import { navForRole } from "../../lib/navigation";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: "Navigate" | "Quick actions" | "Search";
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const items = useMemo<CommandItem[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      onClose();
    };
    const navigation: CommandItem[] = navForRole(user).map((item) => ({
      id: `nav-${item.path}`,
      label: item.label,
      icon: item.icon,
      group: "Navigate",
      run: go(item.path),
    }));
    const actions: CommandItem[] = [
      {
        id: "action-lead",
        label: "Add a new lead",
        hint: "Open the lead form",
        icon: UserPlus,
        group: "Quick actions",
        run: go("/leads?new=1"),
      },
      {
        id: "action-call",
        label: "Record a call",
        hint: "Log an outcome against a lead",
        icon: PhoneCall,
        group: "Quick actions",
        run: go("/calls?new=1"),
      },
      {
        id: "action-proposal",
        label: "Create a proposal",
        hint: "Pick a template and draft",
        icon: FilePlus2,
        group: "Quick actions",
        run: go("/proposals?new=1"),
      },
      {
        id: "action-meeting",
        label: "Schedule a meeting",
        hint: "Google Meet, on-site or phone",
        icon: CalendarPlus,
        group: "Quick actions",
        run: go("/meetings?new=1"),
      },
      {
        id: "action-help",
        label: "Open Help Centre",
        hint: "User manuals, module guides and FAQs",
        icon: HelpCircle,
        group: "Quick actions",
        run: go("/help"),
      },
      {
        id: "action-attendance-guide",
        label: "Attendance Guide",
        hint: "Multiple check-in/out policies & calculations",
        icon: BookOpen,
        group: "Quick actions",
        run: go("/help?tab=attendance_guide"),
      },
    ];
    const search: CommandItem[] = query.trim()
      ? [
          {
            id: "search-leads",
            label: `Search leads for “${query.trim()}”`,
            icon: Search,
            group: "Search",
            run: go(`/leads?q=${encodeURIComponent(query.trim())}`),
          },
        ]
      : [];
    return [...navigation, ...actions, ...search];
  }, [navigate, onClose, query, user?.role]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    const matched = items.filter(
      (item) =>
        item.group === "Search" ||
        item.label.toLowerCase().includes(term) ||
        item.hint?.toLowerCase().includes(term)
    );
    return matched;
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] ?? []), item];
    return acc;
  }, {});

  return createPortal(
    <div className="fixed inset-0 z-[115] flex items-start justify-center px-4 pt-[10vh]">
      <div className="fade-enter absolute inset-0 bg-ink-900/30" onClick={onClose} aria-hidden="true" />
      <div
        className="pop-enter relative w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-white shadow-pop"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((value) => Math.min(value + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                filtered[activeIndex]?.run();
              }
            }}
            placeholder="Search pages, actions or leads…"
            className="h-12 flex-1 border-0 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0"
            aria-label="Command search"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[9.5px] text-ink-400">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-ink-400">
              No matches. Try a different term.
            </p>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group} className="mb-1">
                <p className="px-2.5 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                  {group}
                </p>
                {groupItems.map((item) => {
                  const index = filtered.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={item.run}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        index === activeIndex
                          ? "bg-brand-50 text-brand-700"
                          : "text-ink-600 hover:bg-canvas"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate text-[12.5px] font-medium">{item.label}</span>
                      {item.hint ? (
                        <span className="hidden truncate text-[10px] text-ink-400 sm:block">
                          {item.hint}
                        </span>
                      ) : null}
                      <ArrowRight
                        className={cn(
                          "h-3.5 w-3.5",
                          index === activeIndex ? "text-brand-500" : "text-ink-300"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line bg-[#fcfbfe] px-4 py-2 text-[10px] text-ink-400">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span className="ml-auto">STACKZYRO CRM</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

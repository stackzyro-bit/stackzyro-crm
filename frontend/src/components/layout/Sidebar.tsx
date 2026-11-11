import { LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { cn } from "../../lib/format";
import { navForRole } from "../../lib/navigation";
import { Avatar } from "../ui/Avatar";
import { Logo } from "../ui/Logo";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const items = navForRole(user);
  const compact = collapsed;
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const res = await api.get<{ total_unread: number }>("/messages/unread-count");
        if (mounted && typeof res?.total_unread === "number") {
          setUnreadCount(res.total_unread);
        }
      } catch {
        // quiet error on background count fetch
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [location.pathname]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink-900/35 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line bg-white transition-transform duration-200 ease-out print:hidden lg:translate-x-0 lg:transition-[width]",
          compact ? "lg:w-[80px]" : "lg:w-[264px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className={cn(
            "flex h-[68px] shrink-0 items-center border-b border-line",
            compact ? "lg:justify-center lg:px-0" : "justify-between px-4"
          )}
        >
          <Link to="/dashboard" onClick={onCloseMobile} className="min-w-0" aria-label="STACKZYRO dashboard">
            <Logo collapsed={compact} className={compact ? "hidden lg:flex" : "flex"} />
            <div className={compact ? "lg:hidden" : "hidden"}>
              <Logo />
            </div>
          </Link>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "hidden rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700 lg:inline-flex",
              compact && "lg:hidden"
            )}
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            title={compact ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {compact ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mx-auto mt-3 hidden rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700 lg:inline-flex"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : null}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p
            className={cn(
              "mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400",
              compact && "lg:hidden"
            )}
          >
            Workspace
          </p>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`);
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onCloseMobile}
                    title={compact ? item.label : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg py-2 text-[13px] transition-colors relative",
                      compact ? "lg:justify-center lg:px-0" : "px-2.5",
                      active
                        ? "bg-brand-50 font-semibold text-brand-700"
                        : "font-medium text-ink-600 hover:bg-[#f8f5fd] hover:text-ink-900"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Icon
                        className={cn(
                          "h-[17px] w-[17px]",
                          active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"
                        )}
                        strokeWidth={active ? 2.1 : 1.9}
                      />
                      {compact && item.path === "/messages" && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                      )}
                    </div>
                    <span className={cn("truncate flex-1", compact && "lg:hidden")}>{item.label}</span>
                    {!compact && item.path === "/messages" && unreadCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={cn("shrink-0 border-t border-line p-3", compact && "lg:px-2")}>
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-1 py-1",
              compact && "lg:flex-col lg:gap-2"
            )}
          >
            <Avatar name={user?.name} size="md" />
            <div className={cn("min-w-0 flex-1", compact && "lg:hidden")}>
              <p className="truncate text-[12.5px] font-semibold text-ink-900">{user?.name}</p>
              <p className="truncate text-[10.5px] text-ink-400">
                {user?.designation || (user?.role === "admin" ? "Super Admin" : "Staff")}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

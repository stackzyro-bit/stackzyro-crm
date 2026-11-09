import {
  Activity as ActivityIcon,
  Bell,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Compass,
  FileText,
  HelpCircle,
  Home,
  Menu,
  PhoneCall,
  Search,
  Send,
  Settings,
  UserPlus,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTour } from "../../context/TourContext";
import { api } from "../../lib/api";
import { cn, relativeTime } from "../../lib/format";
import { findNavItem } from "../../lib/navigation";
import type { Activity } from "../../lib/types";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  lead_added: UserPlus,
  call_completed: PhoneCall,
  followup_scheduled: CalendarClock,
  followup_completed: CalendarClock,
  proposal_created: FileText,
  proposal_sent: Send,
  proposal_accepted: FileText,
  proposal_rejected: FileText,
  meeting_scheduled: CalendarDays,
  client_converted: Building2,
  lead_converted: Building2,
};

function breadcrumbFor(pathname: string): { section: string; page: string } {
  const item = findNavItem(pathname);
  if (!item) return { section: "Dashboard", page: "Dashboard" };
  if (item.path !== "/proposals") return { section: item.label, page: item.label };
  const rest = pathname.slice(item.path.length).replace(/^\//, "");
  if (!rest) return { section: "Proposals", page: "Proposals" };
  if (rest === "new") return { section: "Proposals", page: "New proposal" };
  if (rest.endsWith("/edit")) return { section: "Proposals", page: "Edit proposal" };
  if (rest.endsWith("/preview")) return { section: "Proposals", page: "Proposal preview" };
  return { section: "Proposals", page: "Proposal" };
}

export function Topbar({
  onOpenMobile,
  onOpenSearch,
}: {
  onOpenMobile: () => void;
  onOpenSearch: () => void;
}) {
  const { user, logout } = useAuth();
  const { restartTour } = useTour();
  const location = useLocation();
  const navigate = useNavigate();
  const { section, page } = breadcrumbFor(location.pathname);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activityFeed, setActivityFeed] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!notificationRef.current?.contains(target)) setNotificationsOpen(false);
      if (!profileRef.current?.contains(target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    let active = true;
    setActivityLoading(true);
    api
      .get<{ items: Activity[] }>("/activities", { limit: 8 })
      .then((data) => {
        if (active) setActivityFeed(data.items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setActivityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notificationsOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white print:hidden">
      <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobile}
          className="-ml-1 rounded-lg p-2 text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <nav className="flex items-center gap-1 text-[10.5px] text-ink-400" aria-label="Breadcrumb">
            <Link to="/dashboard" className="transition-colors hover:text-brand-600" aria-label="Dashboard">
              <Home className="h-3 w-3" />
            </Link>
            <ChevronRight className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">{section}</span>
            {page !== section ? (
              <>
                <ChevronRight className="hidden h-2.5 w-2.5 sm:inline" />
                <span className="truncate">{page}</span>
              </>
            ) : null}
          </nav>
          <h1 className="mt-0.5 truncate text-[15px] font-semibold leading-tight text-ink-900">
            {page}
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-9 w-60 items-center gap-2 rounded-lg border border-line bg-canvas px-3 text-left text-xs text-ink-400 transition-colors hover:border-brand-200 hover:bg-white hover:text-ink-500 md:flex xl:w-72"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Search or jump to…</span>
          <kbd className="rounded border border-line bg-white px-1 py-0.5 font-sans text-[9.5px] text-ink-400">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900 md:hidden"
          aria-label="Search"
        >
          <Search className="h-4.5 w-4.5" />
        </button>

        <Link
          to="/help"
          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900"
          title="Help Centre & User Manuals"
          aria-label="Help Centre"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </Link>

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((value) => !value)}
            className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 ring-2 ring-white" />
          </button>
          {notificationsOpen ? (
            <div className="pop-enter absolute right-0 top-11 w-[320px] overflow-hidden rounded-xl border border-line bg-white shadow-pop">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-[12.5px] font-semibold text-ink-900">Recent activity</p>
                <Badge tone="purple">Live</Badge>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {activityLoading ? (
                  <p className="px-4 py-6 text-center text-xs text-ink-400">Loading activity…</p>
                ) : activityFeed.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-ink-400">No activity yet.</p>
                ) : (
                  activityFeed.map((activity) => {
                    const Icon = ACTIVITY_ICONS[activity.type] ?? ActivityIcon;
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-2.5 border-b border-line px-4 py-3 last:border-0"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-medium leading-snug text-ink-800">
                            {activity.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-400">
                            {relativeTime(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(false);
                  navigate("/dashboard");
                }}
                className="w-full border-t border-line bg-[#fcfbfe] px-4 py-2.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                View dashboard activity
              </button>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((value) => !value)}
            className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-canvas"
            aria-label="Profile menu"
            aria-expanded={profileOpen}
          >
            <Avatar name={user?.name} size="sm" />
            <span className="hidden text-left xl:block">
              <span className="block max-w-[120px] truncate text-[11.5px] font-semibold text-ink-900">
                {user?.name}
              </span>
              <span className="block text-[10px] capitalize text-ink-400">{user?.role}</span>
            </span>
          </button>
          {profileOpen ? (
            <div className="pop-enter absolute right-0 top-11 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
              <div className="border-b border-line px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={user?.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink-900">{user?.name}</p>
                    <p className="truncate text-[10.5px] text-ink-400">{user?.email}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <Badge tone={user?.role === "admin" ? "purple" : "blue"}>
                    {user?.role === "admin" ? "Administrator" : "Staff member"}
                  </Badge>
                  <span className="text-[10px] text-ink-400">{user?.staff_code}</span>
                </div>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/help");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Help Centre & Manuals
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    restartTour();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Take interactive tour
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/settings");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Account settings
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium",
                    "text-rose-600 transition-colors hover:bg-rose-50"
                  )}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

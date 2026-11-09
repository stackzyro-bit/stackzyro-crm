import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { hasPermission, type User } from "./types";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  moduleKey?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { label: "Leads", path: "/leads", icon: Users, moduleKey: "leads" },
  { label: "Call Management", path: "/calls", icon: PhoneCall, moduleKey: "calls" },
  { label: "Follow-ups", path: "/followups", icon: CalendarClock, moduleKey: "followups" },
  { label: "Proposals", path: "/proposals", icon: FileText, moduleKey: "proposals" },
  { label: "Meetings", path: "/meetings", icon: CalendarDays, moduleKey: "meetings" },
  { label: "Clients", path: "/clients", icon: Building2, moduleKey: "clients" },
  { label: "Attendance", path: "/attendance", icon: ClipboardCheck, moduleKey: "attendance" },
  { label: "Messages", path: "/messages", icon: MessageSquare, moduleKey: "messages" },
  { label: "Staff Management", path: "/staff", icon: UserCog, adminOnly: true, moduleKey: "staff" },
  { label: "Reports", path: "/reports", icon: BarChart3, moduleKey: "reports" },
  { label: "Settings", path: "/settings", icon: Settings, moduleKey: "settings" },
  { label: "Help Centre", path: "/help", icon: HelpCircle, moduleKey: "help" },
];

export function navForRole(user: User | null | undefined): NavItem[] {
  if (!user) return [];
  if (user.role === "admin") return NAV_ITEMS;

  return NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return false;
    if (item.moduleKey === "help") return true;
    if (item.moduleKey) {
      return hasPermission(user, item.moduleKey, "view");
    }
    return true;
  });
}

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
}

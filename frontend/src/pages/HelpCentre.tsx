import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Compass,
  FileCheck2,
  FileText,
  Filter,
  HelpCircle,
  Info,
  KeyRound,
  LayoutDashboard,
  Layers,
  Lock,
  PhoneCall,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useTour } from "../context/TourContext";
import { cn } from "../lib/format";
import {
  ATTENDANCE_SCHEDULE_EXAMPLE,
  DAILY_ROUTINE_STEPS,
  FAQ_ITEMS,
  MODULE_DOCS,
  ROLE_PERMISSION_EXAMPLES,
  TROUBLESHOOTING_GUIDE,
  type ModuleDocumentation,
} from "../lib/helpContent";

type HelpTab =
  | "overview"
  | "admin_guide"
  | "staff_guide"
  | "attendance_guide"
  | "modules"
  | "faq"
  | "troubleshooting";

const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Users,
  calls: PhoneCall,
  followups: CalendarClock,
  proposals: FileText,
  meetings: CalendarDays,
  clients: Building2,
  attendance: ClipboardCheck,
  staff: UserCog,
  reports: BarChart3,
  settings: Settings,
  audit_logs: ShieldCheck,
};

export function HelpCentre() {
  const { user } = useAuth();
  const { restartTour } = useTour();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = user?.role === "admin";

  // URL state
  const activeTab = (searchParams.get("tab") as HelpTab) || "overview";
  const selectedModuleKey = searchParams.get("module") || "leads";
  const [searchQuery, setSearchQuery] = useState("");
  const [adminViewMode, setAdminViewMode] = useState<"admin" | "staff">(
    isAdmin ? "admin" : "staff"
  );
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const setTab = (tab: HelpTab, moduleKey?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    if (moduleKey) {
      nextParams.set("module", moduleKey);
    }
    setSearchParams(nextParams);
  };

  // Filter modules based on user permissions if staff
  const visibleModules = useMemo(() => {
    return Object.values(MODULE_DOCS).filter((mod) => {
      if (isAdmin) return true;
      if (mod.key === "staff" || mod.key === "audit_logs") return false;
      return true;
    });
  }, [isAdmin]);

  // Search filtering
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_ITEMS;
    const q = searchQuery.toLowerCase();
    return FAQ_ITEMS.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredTroubleshooting = useMemo(() => {
    if (!searchQuery.trim()) return TROUBLESHOOTING_GUIDE;
    const q = searchQuery.toLowerCase();
    return TROUBLESHOOTING_GUIDE.filter(
      (t) =>
        t.issue.toLowerCase().includes(q) ||
        t.symptom.toLowerCase().includes(q) ||
        t.cause.toLowerCase().includes(q) ||
        t.resolution.some((r) => r.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const selectedModuleDoc: ModuleDocumentation =
    MODULE_DOCS[selectedModuleKey] || MODULE_DOCS.leads;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="STACKZYRO Help Centre & Knowledge Base"
        description="Complete operational manual, module-by-module workflows, step-by-step user guides, attendance policies, and system troubleshooting."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={restartTour}
            >
              Restart Onboarding Tour
            </Button>
            {isAdmin ? (
              <div className="flex items-center rounded-lg border border-line bg-canvas p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAdminViewMode("admin")}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    adminViewMode === "admin"
                      ? "bg-brand-600 text-white shadow-xs"
                      : "text-ink-600 hover:text-ink-900"
                  )}
                >
                  Admin View
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode("staff")}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    adminViewMode === "staff"
                      ? "bg-brand-600 text-white shadow-xs"
                      : "text-ink-600 hover:text-ink-900"
                  )}
                >
                  Staff View
                </button>
              </div>
            ) : (
              <Badge tone="blue">Staff Guide View</Badge>
            )}
          </div>
        }
      />

      {/* Hero Search & Quick Access Banner */}
      <Card className="border-brand-100 bg-gradient-to-br from-[#faf8ff] via-white to-[#f5f0ff]">
        <CardBody className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge tone="purple">STACKZYRO CRM Manual</Badge>
                <span className="text-xs text-ink-400">Version 1.0</span>
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-ink-900 sm:text-xl">
                How can we help you succeed today?
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Explore comprehensive operational manuals, attendance rules, step-by-step
                instructions, and answers to common CRM questions.
              </p>
            </div>

            {/* Quick Stat Pills */}
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 shadow-xs">
                <BookOpen className="h-3.5 w-3.5 text-brand-600" />
                <span className="font-semibold text-ink-900">12</span>
                <span className="text-ink-500">Module Manuals</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                <span className="font-semibold text-ink-900">2</span>
                <span className="text-ink-500">Role Guides</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 shadow-xs">
                <HelpCircle className="h-3.5 w-3.5 text-brand-600" />
                <span className="font-semibold text-ink-900">15+</span>
                <span className="text-ink-500">Answers & FAQs</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="mt-5 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
            <input
              type="text"
              placeholder="Search guides, modules, attendance policies, FAQs, or troubleshooting..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border border-brand-200 bg-white pl-10 pr-4 text-xs font-medium text-ink-900 placeholder:text-ink-400 shadow-xs transition-colors focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-400 hover:text-ink-700"
              >
                Clear
              </button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* Main Layout: Left Navigation + Right Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="py-3 px-4 border-b border-line">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Documentation Sections
              </p>
            </CardHeader>
            <CardBody className="p-2 space-y-1">
              <button
                type="button"
                onClick={() => setTab("overview")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  activeTab === "overview"
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                )}
              >
                <Compass className="h-4 w-4 shrink-0 text-brand-600" />
                <span>Overview & System Intro</span>
              </button>

              {isAdmin && adminViewMode === "admin" ? (
                <button
                  type="button"
                  onClick={() => setTab("admin_guide")}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                    activeTab === "admin_guide"
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
                  <span>Admin User Guide</span>
                  <Badge tone="purple" className="ml-auto text-[9px]">
                    Admin
                  </Badge>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setTab("staff_guide")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  activeTab === "staff_guide"
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                )}
              >
                <UserCheck className="h-4 w-4 shrink-0 text-brand-600" />
                <span>Staff User Guide</span>
                <Badge tone="blue" className="ml-auto text-[9px]">
                  Daily Guide
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setTab("attendance_guide")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  activeTab === "attendance_guide"
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                )}
              >
                <ClipboardCheck className="h-4 w-4 shrink-0 text-brand-600" />
                <span>Continuous Attendance Guide</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("modules", selectedModuleKey)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  activeTab === "modules"
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                )}
              >
                <Layers className="h-4 w-4 shrink-0 text-brand-600" />
                <span>Module-by-Module Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("faq")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  activeTab === "faq"
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                )}
              >
                <HelpCircle className="h-4 w-4 shrink-0 text-brand-600" />
                <span>Frequently Asked Questions</span>
                <span className="ml-auto text-[10px] text-ink-400">15+</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("troubleshooting")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  activeTab === "troubleshooting"
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                )}
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-brand-600" />
                <span>Troubleshooting Guide</span>
              </button>
            </CardBody>
          </Card>

          {/* Quick Module Sub-links if on modules tab */}
          {activeTab === "modules" ? (
            <Card>
              <CardHeader className="py-2.5 px-3 border-b border-line">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Select CRM Module
                </p>
              </CardHeader>
              <CardBody className="p-1 space-y-0.5">
                {visibleModules.map((mod) => {
                  const Icon = MODULE_ICON_MAP[mod.key] || BookOpen;
                  const isSelected = selectedModuleKey === mod.key;
                  return (
                    <button
                      key={mod.key}
                      type="button"
                      onClick={() => setTab("modules", mod.key)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] transition-colors",
                        isSelected
                          ? "bg-brand-50 font-semibold text-brand-700"
                          : "text-ink-600 hover:bg-canvas hover:text-ink-900"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                      <span className="truncate">{mod.title}</span>
                    </button>
                  );
                })}
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Right Content View */}
        <div className="lg:col-span-9 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div>
                    <h3 className="text-base font-bold text-ink-900">
                      Welcome to the STACKZYRO CRM User Manual
                    </h3>
                    <p className="mt-1 text-xs text-ink-500">
                      STACKZYRO — Turning Ideas Into Digital Solutions
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4 text-xs leading-relaxed text-ink-700">
                  <p>
                    STACKZYRO CRM is a high-performance customer relationship management platform
                    tailored for high-growth software, website development, and digital marketing
                    agencies. The system connects lead acquisition, outbound calls, scheduled
                    follow-ups, technical proposals, discovery meetings, client delivery, continuous
                    workplace attendance, and executive intelligence.
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-brand-600" />
                        <h4 className="font-bold text-ink-900">The Administrator Role</h4>
                      </div>
                      <p className="mt-2 text-ink-600 leading-relaxed">
                        Responsible for company operations, employee provisioning, role security,
                        commercial proposal authorization, attendance audit corrections, and
                        performance reporting.
                      </p>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setTab("admin_guide")}
                          className="mt-3 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                        >
                          Read Admin Guide →
                        </button>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-emerald-600" />
                        <h4 className="font-bold text-ink-900">The Staff Member Role</h4>
                      </div>
                      <p className="mt-2 text-ink-600 leading-relaxed">
                        Responsible for researching assigned businesses, making professional calls,
                        logging customer interactions, scheduling follow-ups, and recording daily
                        workplace attendance.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab("staff_guide")}
                        className="mt-3 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                      >
                        Read Staff Guide →
                      </button>
                    </div>
                  </div>

                  {/* Core Principles */}
                  <div className="rounded-xl border border-line bg-canvas p-4 space-y-2">
                    <h4 className="font-bold text-ink-900">Core CRM Architecture Principles</h4>
                    <ul className="space-y-1.5 pl-1">
                      <li className="flex items-start gap-2 text-ink-600">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span>
                          <strong>Zero Fake Data:</strong> No card or metric is hardcoded; all values
                          calculate directly from database records.
                        </span>
                      </li>
                      <li className="flex items-start gap-2 text-ink-600">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span>
                          <strong>Continuous Attendance:</strong> Attendance is not just 9 AM and 5
                          PM; every departure and return is logged for transparent working time.
                        </span>
                      </li>
                      <li className="flex items-start gap-2 text-ink-600">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span>
                          <strong>Zero Overwriting:</strong> Every conversation creates its own
                          distinct call history record, protecting customer relationships.
                        </span>
                      </li>
                      <li className="flex items-start gap-2 text-ink-600">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span>
                          <strong>Cryptographic Security:</strong> Passwords are one-way hashed with
                          bcrypt; Admins cannot view passwords.
                        </span>
                      </li>
                    </ul>
                  </div>
                </CardBody>
              </Card>

              {/* Roles & Permissions Matrix Preview */}
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-bold text-ink-900">
                    Role-Based Access Control (RBAC) Overview
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="text-xs text-ink-600 leading-relaxed">
                    STACKZYRO CRM enforces strict principle of least privilege. Staff members only
                    see modules necessary to perform their assigned job duties.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-line">
                      <thead className="bg-canvas border-b border-line text-ink-700">
                        <tr>
                          <th className="p-2.5 font-semibold">Role Profile</th>
                          <th className="p-2.5 font-semibold">Department</th>
                          <th className="p-2.5 font-semibold">Permitted Modules</th>
                          <th className="p-2.5 font-semibold">Access Rationale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ROLE_PERMISSION_EXAMPLES.map((ex, idx) => (
                          <tr key={idx} className="hover:bg-canvas/50">
                            <td className="p-2.5 font-medium text-ink-900">{ex.roleTitle}</td>
                            <td className="p-2.5 text-ink-500">{ex.department}</td>
                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(ex.recommendedPermissions)
                                  .filter(([_, perms]) => perms.length > 0)
                                  .map(([mod]) => (
                                    <Badge key={mod} tone="purple" className="text-[10px]">
                                      {mod}
                                    </Badge>
                                  ))}
                              </div>
                            </td>
                            <td className="p-2.5 text-ink-600 text-[11px] max-w-xs">
                              {ex.rationale}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {/* TAB 2: ADMIN USER GUIDE */}
          {activeTab === "admin_guide" && isAdmin ? (
            <div className="space-y-6">
              <Card className="border-brand-200">
                <CardHeader className="bg-gradient-to-r from-brand-50 to-white">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-brand-600" />
                    <div>
                      <h3 className="text-base font-bold text-ink-900">
                        STACKZYRO CRM – Complete Administrator Manual
                      </h3>
                      <p className="text-xs text-ink-500">
                        Operational guide for managing company workforce, sales funnels, and system
                        governance.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="space-y-6 text-xs text-ink-700 leading-relaxed">
                  {/* Section A: Admin Dashboard */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-brand-600" />
                      Section A: Admin Dashboard & Operational Monitoring
                    </h4>
                    <p>
                      The Admin Dashboard gives you real-time visibility into the health of your
                      entire enterprise. Every single number and graph is generated directly from
                      database records.
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Total Leads</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Total prospective clients in database, with 30-day velocity.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">New Leads</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Enquiries not yet contacted; must be assigned to staff promptly.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Interested Leads</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          High-intent prospects verified by staff phone calls.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Pending Follow-ups</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Scheduled calls, visits, or messages due across all employees.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Scheduled Meetings</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Upcoming Google Meet, on-site, or phone discovery sessions.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Proposals Sent & Accepted</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Commercial quotations delivered vs successfully closed revenue.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Converted Clients</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Active accounts actively receiving technical project execution.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Staff Overview & Attendance</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Live counts of who is currently working, on break, or absent today.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <p className="font-semibold text-ink-900">Live Activity Feed</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Audit stream of all new leads, completed calls, and converted clients.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Staff Management 10-Step Guide */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-brand-600" />
                      Section B: Staff & User Management (10-Step Setup Guide)
                    </h4>
                    <p>
                      Follow this exact 10-step sequence whenever onboarding a new employee into the
                      CRM:
                    </p>
                    <div className="space-y-2">
                      {[
                        "Open Settings from the navigation bar or top right profile menu.",
                        "Select 'Staff & User Management' (or navigate directly to /staff).",
                        "Click the '+ Add Staff' button at the top right.",
                        "Enter employee information: Full Name, Email, Phone, Staff Code (e.g. STF-011), Designation, and Department.",
                        "Create a distinct, unique username (e.g. ayesha.sales).",
                        "Set a temporary password (min 8 chars) and confirm it.",
                        "Assign the Role: 'Staff' for standard employees, or 'Admin' for executive managers.",
                        "Select Module Permissions using the interactive action checkbox matrix (view, create, edit, delete, export, approve, assign).",
                        "Save the account by clicking 'Create Staff Member'. The system flags `must_change_password = true`.",
                        "Provide the login credentials securely to the employee in person or via encrypted messaging. The employee will be forced to set their own private password upon first login.",
                      ].map((stepText, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 rounded-lg border border-line p-2 bg-canvas/40">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-ink-800">{stepText}</span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5 text-amber-900 text-xs">
                      <Lock className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                      <div>
                        <p className="font-semibold">Security Requirement: No Plain-Text Passwords</p>
                        <p className="mt-0.5 leading-relaxed text-amber-800">
                          STACKZYRO CRM never stores or reveals existing user passwords. Passwords
                          are irreversibly hashed with bcrypt. If an employee forgets their
                          password, use the 'Reset Password' action in Staff Management to assign a
                          new temporary password.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section C: Roles & Permissions */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-brand-600" />
                      Section C: Roles & Permissions Architecture
                    </h4>
                    <p>
                      Admins control granular access actions per module. Never grant unnecessary
                      privileges to operational staff.
                    </p>
                    <ul className="space-y-1.5 pl-2">
                      <li>
                        <strong>View:</strong> Read records and browse listings.
                      </li>
                      <li>
                        <strong>Create:</strong> Add new leads, record calls, schedule meetings, or draft proposals.
                      </li>
                      <li>
                        <strong>Edit:</strong> Update client details, change requirements, or modify proposal scopes.
                      </li>
                      <li>
                        <strong>Delete:</strong> Permanently erase records (strictly reserved for Admins).
                      </li>
                      <li>
                        <strong>Export:</strong> Download datasets to CSV (restrict to prevent data leakage).
                      </li>
                      <li>
                        <strong>Approve:</strong> Authorize commercial proposals for client delivery.
                      </li>
                      <li>
                        <strong>Assign:</strong> Reassign leads or clients to different team members.
                      </li>
                    </ul>
                  </div>

                  {/* Section D: Lead & Call Management */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-brand-600" />
                      Section D & E: Lead & Call Management
                    </h4>
                    <p>
                      Leads represent potential revenue. Every conversation requires a separate call
                      entry to maintain a complete audit timeline.
                    </p>
                    <ul className="space-y-1 pl-2">
                      <li>
                        • <strong>Lead Statuses:</strong> New → Interested → Proposal Required → Accepted → Converted (or Not Interested).
                      </li>
                      <li>
                        • <strong>Call Outcomes:</strong> Interested, Not Interested, Not Taken, Call Back Requested, Accepted, Proposal Required, Do Not Contact.
                      </li>
                      <li>
                        • <strong>Zero Overwrite Policy:</strong> When calling an existing client, click 'Record Call' on that lead rather than creating a duplicate lead.
                      </li>
                    </ul>
                  </div>

                  {/* Section J: Attendance Management */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-brand-600" />
                      Section J: Attendance Management & Multiple Check-In/Out
                    </h4>
                    <p>
                      Admins have full oversight over employee presence. The Live Board provides
                      instant visual cues on staff working vs break status.
                    </p>
                    <ul className="space-y-1.5 pl-2">
                      <li>
                        • <strong>Live Board:</strong> Shows green for working, amber for on break, and grey for not checked in.
                      </li>
                      <li>
                        • <strong>Audit Corrections:</strong> If an employee misses a check-out, click 'Correct Session', enter the accurate timestamp, and input a mandatory explanation.
                      </li>
                      <li>
                        • <strong>Reporting:</strong> Export Daily Session breakdowns and Monthly staff presence matrices with 1 click.
                      </li>
                    </ul>
                  </div>

                  {/* Section K & L: Reports & Audit Logs */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-brand-600" />
                      Section K & L: Business Reports & Audit Security Trail
                    </h4>
                    <p>
                      The Reports module provides 8 distinct intelligence views. Audit Logs track
                      every credential change, permission edit, and attendance manual correction
                      with IP addresses and before/after states for total accountability.
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {/* TAB 3: STAFF USER GUIDE */}
          {activeTab === "staff_guide" ? (
            <div className="space-y-6">
              <Card className="border-emerald-200">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-white">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h3 className="text-base font-bold text-ink-900">
                        STACKZYRO CRM – Staff User Guide & Daily Playbook
                      </h3>
                      <p className="text-xs text-ink-500">
                        Practical step-by-step instructions for employees to perform their daily duties.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="space-y-6 text-xs text-ink-700 leading-relaxed">
                  {/* First Login */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-brand-600" />
                      A. First Login & Account Setup
                    </h4>
                    <ol className="space-y-1.5 pl-2 list-decimal list-inside">
                      <li>Receive your username and temporary password from your Administrator.</li>
                      <li>Open the STACKZYRO CRM login page at http://localhost:5173.</li>
                      <li>Enter your credentials and click 'Sign In'.</li>
                      <li>When prompted by the system, enter a strong new private password known only to you.</li>
                      <li>Take the interactive onboarding tour to familiarize yourself with your workspace.</li>
                      <li>Review the Help Centre whenever you are unsure how to execute a task.</li>
                    </ol>
                  </div>

                  {/* Staff Dashboard */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-brand-600" />
                      B. Your Personal Dashboard
                    </h4>
                    <p>
                      Your dashboard displays only items assigned directly to you:
                    </p>
                    <ul className="space-y-1 pl-2">
                      <li>• <strong>My Assigned Leads:</strong> Enquiries assigned to your portfolio.</li>
                      <li>• <strong>My Calls Today:</strong> Counter tracking your phone consultation volume.</li>
                      <li>• <strong>Pending Follow-ups:</strong> Scheduled tasks due today that require action.</li>
                      <li>• <strong>Scheduled Meetings:</strong> Upcoming Google Meet or on-site client discovery calls.</li>
                      <li>• <strong>Today's Attendance Widget:</strong> 1-click Check In and Check Out buttons.</li>
                    </ul>
                  </div>

                  {/* Attendance Multiple Check-in/out */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-brand-600" />
                      C. Attendance – Continuous Multiple Check-In & Check-Out
                    </h4>
                    <p>
                      Attendance is continuous. You must record every time you step away from work
                      and every time you return.
                    </p>

                    <div className="rounded-xl border border-line bg-canvas p-3 space-y-2">
                      <p className="font-semibold text-ink-900">
                        Typical Working Day Example Schedule:
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-line bg-white">
                          <thead className="bg-canvas border-b border-line text-ink-700">
                            <tr>
                              <th className="p-2 font-semibold">Time</th>
                              <th className="p-2 font-semibold">Action</th>
                              <th className="p-2 font-semibold">Selected Reason</th>
                              <th className="p-2 font-semibold">Status State</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {ATTENDANCE_SCHEDULE_EXAMPLE.map((row, idx) => (
                              <tr key={idx} className="hover:bg-canvas/50">
                                <td className="p-2 font-mono text-[11px] text-ink-600">
                                  {row.time}
                                </td>
                                <td className="p-2">
                                  <Badge tone={row.action === "Check In" ? "green" : "amber"}>
                                    {row.action}
                                  </Badge>
                                </td>
                                <td className="p-2 font-medium text-ink-900">{row.reason}</td>
                                <td className="p-2 text-ink-500">{row.state}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-1.5 pl-2">
                      <p className="font-semibold text-ink-900">Important Attendance Rules:</p>
                      <p>
                        1. Press <strong>Check In</strong> immediately upon starting work in the morning or returning from a break.
                      </p>
                      <p>
                        2. Press <strong>Check Out</strong> whenever leaving your desk. Pick the truthful reason (Lunch, Client Visit, Tea, etc.).
                      </p>
                      <p>
                        3. Never ask a colleague to check in on your behalf—proxy attendance is grounds for disciplinary action.
                      </p>
                      <p>
                        4. If you forgot an event, notify Admin right away so a correction can be documented.
                      </p>
                    </div>
                  </div>

                  {/* 12-Step Daily Work Routine */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1.5 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-brand-600" />
                      J. The 12-Step Practical Daily Work Routine
                    </h4>
                    <p>
                      Follow this daily routine to achieve peak productivity and maintain high CRM data quality:
                    </p>
                    <div className="space-y-2">
                      {DAILY_ROUTINE_STEPS.map((step) => (
                        <div
                          key={step.step}
                          className="flex items-start gap-3 rounded-lg border border-line bg-canvas/40 p-2.5"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                            {step.step}
                          </span>
                          <div>
                            <p className="font-semibold text-ink-900">{step.title}</p>
                            <p className="mt-0.5 text-ink-600">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Professional Ethics */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                    <h4 className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      Professional Integrity & CRM Ethics
                    </h4>
                    <ul className="mt-2 space-y-1 text-xs text-rose-800 pl-1">
                      <li>• Never fabricate call logs or invent customer requirements.</li>
                      <li>• Never mark a lead 'Accepted' or 'Converted' without signed agreement.</li>
                      <li>• Never send unapproved pricing quotations or promise unauthorized discounts.</li>
                      <li>• Strictly honor client requests: if marked 'Do Not Contact', stop outreach.</li>
                    </ul>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {/* TAB 4: CONTINUOUS ATTENDANCE GUIDE */}
          {activeTab === "attendance_guide" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-brand-600" />
                    <div>
                      <h3 className="text-base font-bold text-ink-900">
                        Continuous Multiple Check-In / Check-Out Architecture
                      </h3>
                      <p className="text-xs text-ink-500">
                        How STACKZYRO CRM calculates precise working duration and break intervals.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="space-y-5 text-xs text-ink-700 leading-relaxed">
                  <p>
                    Modern digital workplaces require flexible tracking. Team members leave for
                    client meetings, business visits, tea breaks, and lunch. STACKZYRO CRM does not
                    restrict attendance to a single morning check-in and evening check-out. It
                    records each individual work session.
                  </p>

                  {/* Mathematical Formula */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="font-bold text-emerald-900">Total Working Time Calculation</p>
                      <p className="mt-1 font-mono text-emerald-800 text-[11px]">
                        Working Seconds = Σ (Session Check-Out - Session Check-In)
                      </p>
                      <p className="mt-2 text-ink-600">
                        Sum of all elapsed intervals while you are actively checked in and working.
                      </p>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                      <p className="font-bold text-amber-900">Total Break Time Calculation</p>
                      <p className="mt-1 font-mono text-amber-800 text-[11px]">
                        Break Seconds = Σ (Next Check-In - Previous Check-Out)
                      </p>
                      <p className="mt-2 text-ink-600">
                        Sum of all intervals spent away from work during the working day.
                      </p>
                    </div>
                  </div>

                  {/* 8 Departure Reasons */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-ink-900">Standard Check-Out Reasons & Purpose</h4>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">1. Lunch Break</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Standard midday meal departure. Working timer pauses.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">2. Tea / Personal Break</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Short personal refreshment pause outside the office.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">3. Client Meeting</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Off-site discovery or progress conference at client premises.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">4. Business Visit</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Official partner meetings, networking events, or corporate seminars.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">5. Official Work Outside Office</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Hardware procurement, bank visits, or administrative field assignments.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">6. Personal Work</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Temporary departure for personal errands during working hours.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">7. End of Day</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Final departure concluding the working shift for the date.
                        </p>
                      </div>
                      <div className="rounded-lg border border-line p-2.5 bg-canvas">
                        <span className="font-semibold text-ink-900">8. Other</span>
                        <p className="text-ink-500 text-[11px] mt-0.5">
                          Unusual scenarios; always supplement with a clear text note.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Admin Correction Policy */}
                  <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 space-y-2">
                    <h4 className="font-bold text-ink-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-brand-600" />
                      Attendance Correction Governance
                    </h4>
                    <p className="text-ink-600 leading-relaxed">
                      If an employee forgets to check out, their session is flagged. Staff cannot edit
                      their own timestamps. The Administrator must perform a manual correction. Every
                      correction strictly records:
                    </p>
                    <ul className="space-y-1 pl-3 text-ink-700">
                      <li>• The Admin actor ID who authorized the adjustment.</li>
                      <li>• The previous timestamp and the newly corrected timestamp.</li>
                      <li>• A mandatory written reason explaining the correction justification.</li>
                      <li>• An immutable entry in the system Audit Log.</li>
                    </ul>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {/* TAB 5: MODULE-BY-MODULE EXPLANATIONS */}
          {activeTab === "modules" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader className="bg-canvas border-b border-line flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {(() => {
                      const Icon = MODULE_ICON_MAP[selectedModuleDoc.key] || BookOpen;
                      return (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="text-base font-bold text-ink-900">{selectedModuleDoc.title}</h3>
                      <p className="text-xs text-ink-500">{selectedModuleDoc.shortDescription}</p>
                    </div>
                  </div>

                  <Link
                    to={`/${selectedModuleDoc.key}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-xs hover:bg-brand-50"
                  >
                    <span>Open Module in CRM</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </CardHeader>

                <CardBody className="space-y-6 text-xs text-ink-700 leading-relaxed p-5 sm:p-6">
                  {/* Responsibilities split */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 space-y-2">
                      <p className="font-bold text-brand-900 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-brand-600" />
                        Admin Responsibilities
                      </p>
                      <ul className="space-y-1.5">
                        {selectedModuleDoc.adminResponsibilities.map((resp, i) => (
                          <li key={i} className="flex items-start gap-2 text-ink-700">
                            <span className="text-brand-600 font-bold">•</span>
                            <span>{resp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2">
                      <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <UserCheck className="h-4 w-4 text-emerald-600" />
                        Staff Responsibilities
                      </p>
                      <ul className="space-y-1.5">
                        {selectedModuleDoc.staffResponsibilities.map((resp, i) => (
                          <li key={i} className="flex items-start gap-2 text-ink-700">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{resp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1">
                      Step-by-Step Module Workflow
                    </h4>
                    <div className="space-y-2.5">
                      {selectedModuleDoc.workflowSteps.map((ws) => (
                        <div
                          key={ws.step}
                          className="rounded-lg border border-line bg-canvas/60 p-3 space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                              {ws.step}
                            </span>
                            <p className="font-semibold text-ink-900">{ws.title}</p>
                          </div>
                          <p className="text-ink-600 pl-7">{ws.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Lifecycle if present */}
                  {selectedModuleDoc.statusLifecycle ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-ink-900 border-b border-line pb-1">
                        Status Progression Lifecycle
                      </h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedModuleDoc.statusLifecycle.map((st) => (
                          <div key={st.status} className="rounded-lg border border-line p-2.5 bg-canvas">
                            <Badge tone="purple">{st.label}</Badge>
                            <p className="mt-1 text-[11px] text-ink-600">{st.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Best Practices */}
                  <div className="rounded-xl border border-line bg-canvas p-4 space-y-2">
                    <h4 className="font-bold text-ink-900">Best Practices & Pro Tips</h4>
                    <ul className="space-y-1.5 pl-1">
                      {selectedModuleDoc.bestPractices.map((bp, i) => (
                        <li key={i} className="flex items-start gap-2 text-ink-600">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                          <span>{bp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {/* TAB 6: FAQS */}
          {activeTab === "faq" ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <h3 className="text-base font-bold text-ink-900">
                        Frequently Asked Questions (FAQs)
                      </h3>
                      <p className="text-xs text-ink-500">
                        Clear, definitive answers to common user questions across all CRM operations.
                      </p>
                    </div>
                    <Badge tone="purple">{filteredFaqs.length} Answers</Badge>
                  </div>
                </CardHeader>
                <CardBody className="divide-y divide-line p-0">
                  {filteredFaqs.length === 0 ? (
                    <p className="p-6 text-center text-xs text-ink-400">
                      No matching questions found for "{searchQuery}".
                    </p>
                  ) : (
                    filteredFaqs.map((faq, idx) => {
                      const isExpanded = expandedFaq === idx;
                      return (
                        <div key={idx} className="transition-colors hover:bg-canvas/40">
                          <button
                            type="button"
                            onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                            className="flex w-full items-start justify-between gap-4 p-4 text-left"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                                ?
                              </span>
                              <div>
                                <p className="text-xs font-semibold text-ink-900">
                                  {faq.question}
                                </p>
                                <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wider text-brand-600">
                                  Category: {faq.category}
                                </span>
                              </div>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200",
                                isExpanded && "rotate-180 text-brand-600"
                              )}
                            />
                          </button>
                          {isExpanded ? (
                            <div className="px-4 pb-4 pt-1 pl-11 text-xs text-ink-600 leading-relaxed bg-[#faf8fe]/50 border-t border-line/60">
                              <p>{faq.answer}</p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}

          {/* TAB 7: TROUBLESHOOTING */}
          {activeTab === "troubleshooting" ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div>
                    <h3 className="text-base font-bold text-ink-900">
                      Troubleshooting & Diagnostic Guide
                    </h3>
                    <p className="text-xs text-ink-500">
                      Solutions to common access issues, missing checkouts, permission blocks and data anomalies.
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4 p-5 sm:p-6">
                  {filteredTroubleshooting.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-line bg-white p-4 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-line pb-2.5">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <h4 className="text-xs font-bold text-ink-900">{item.issue}</h4>
                        </div>
                        <Badge tone={item.role === "staff" ? "blue" : item.role === "admin" ? "purple" : "grey"}>
                          {item.role === "staff" ? "Staff Issue" : item.role === "admin" ? "Admin Issue" : "All Users"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 bg-canvas/60 p-2.5 rounded-lg border border-line">
                        <div>
                          <span className="font-semibold text-ink-700">Observed Symptom:</span>
                          <p className="text-ink-600 mt-0.5">{item.symptom}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-ink-700">Root Cause:</span>
                          <p className="text-ink-600 mt-0.5">{item.cause}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                          Step-by-Step Resolution:
                        </p>
                        <ul className="space-y-1 text-xs text-ink-700">
                          {item.resolution.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-700">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

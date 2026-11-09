import {
  AlertCircle,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  ImagePlus,
  KeyRound,
  Lock,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Column, DataTable, Pagination } from "../components/ui/DataTable";
import { Field, Input, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { ModuleHelpButton } from "../components/help/ModuleHelpButton";
import { StaffAccountManager } from "../components/staff/StaffAccountManager";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { Tabs } from "../components/ui/Tabs";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../context/MetaContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type { AuditLog, Paginated, SettingsData } from "../lib/types";

const CURRENCIES = ["INR", "USD", "AED", "GBP", "EUR", "SGD"];
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
];

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const { refresh: refreshMeta } = useMeta();
  const toast = useToast();
  const isAdmin = user?.role === "admin";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState(isAdmin ? "company" : "profile");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Forms
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    company_tagline: "",
    company_email: "",
    company_phone: "",
    company_website: "",
    company_address: "",
    company_logo: "",
    proposal_footer: "",
  });

  const [profileForm, setProfileForm] = useState({ name: "", phone: "", designation: "" });

  const [preferences, setPreferences] = useState({
    currency: "INR",
    date_format: "dd MMM yyyy",
    timezone: "Asia/Kolkata",
    followup_reminder_days: "1",
    default_followup_method: "call",
  });

  const [securitySettings, setSecuritySettings] = useState({
    max_login_attempts: 5,
    lockout_minutes: 15,
    session_timeout_mins: 60,
    require_strong_passwords: true,
  });

  const [attendanceSettings, setAttendanceSettings] = useState({
    work_hours_start: "09:30",
    work_hours_end: "18:30",
    grace_period_mins: 15,
    half_day_hours: 4,
  });

  const [crmConfig, setCrmConfig] = useState({
    default_lead_category: "General",
    auto_assign_leads: false,
    require_call_outcome: true,
  });

  const [notifications, setNotifications] = useState({
    email_alerts_enabled: true,
    followup_reminder_email: true,
    daily_digest_email: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [changingPassword, setChangingPassword] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<Paginated<AuditLog> | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditCategory, setAuditCategory] = useState("all");
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const payload = await api.get<SettingsData>("/settings");
      setData(payload);
      setCompanyForm({
        company_name: payload.company.company_name ?? "",
        company_tagline: payload.company.company_tagline ?? "",
        company_email: payload.company.company_email ?? "",
        company_phone: payload.company.company_phone ?? "",
        company_website: payload.company.company_website ?? "",
        company_address: payload.company.company_address ?? "",
        company_logo: payload.company.company_logo ?? "",
        proposal_footer: payload.company.proposal_footer ?? "",
      });
      setProfileForm({
        name: payload.profile.name,
        phone: payload.profile.phone ?? "",
        designation: payload.profile.designation ?? "",
      });
      setPreferences({
        currency: String(payload.preferences.currency ?? "INR"),
        date_format: String(payload.preferences.date_format ?? "dd MMM yyyy"),
        timezone: String(payload.preferences.timezone ?? "Asia/Kolkata"),
        followup_reminder_days: String(payload.preferences.followup_reminder_days ?? 1),
        default_followup_method: String(payload.preferences.default_followup_method ?? "call"),
      });
      if (payload.security) setSecuritySettings(payload.security);
      if (payload.attendance) setAttendanceSettings(payload.attendance);
      if (payload.crm) setCrmConfig(payload.crm);
      if (payload.notifications) setNotifications(payload.notifications);
    } catch (err) {
      toast.error("Could not load settings", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    setAuditLoading(true);
    try {
      const res = await api.get<Paginated<AuditLog>>("/audit-logs", {
        page: auditPage,
        page_size: 10,
        q: auditSearch || undefined,
        category: auditCategory === "all" ? undefined : auditCategory,
      });
      setAuditLogs(res);
    } catch (err) {
      toast.error("Could not load audit logs", err instanceof Error ? err.message : undefined);
    } finally {
      setAuditLoading(false);
    }
  }, [isAdmin, auditPage, auditSearch, auditCategory, toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (tab === "audit") {
      void loadAuditLogs();
    }
  }, [tab, loadAuditLogs]);

  const saveCompany = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<SettingsData>("/settings/company", companyForm);
      setData(updated);
      toast.success("Company profile saved");
      void refreshMeta();
    } catch (err) {
      toast.error("Could not save company profile", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (profileForm.name.trim().length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patch<SettingsData>("/settings/profile", {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || null,
        designation: profileForm.designation.trim() || null,
      });
      setData(updated);
      if (user) {
        setUser({
          ...user,
          name: updated.profile.name,
          phone: updated.profile.phone,
          designation: updated.profile.designation,
        });
      }
      toast.success("Profile updated");
      void refreshMeta();
    } catch (err) {
      toast.error("Could not save profile", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<SettingsData>("/settings/preferences", preferences);
      setData(updated);
      toast.success("Preferences updated");
      void refreshMeta();
    } catch (err) {
      toast.error("Could not save preferences", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (sectionName: string, settingsMap: Record<string, any>) => {
    setSaving(true);
    try {
      const updated = await api.patch<SettingsData>(`/settings/section/${sectionName}`, {
        settings: settingsMap,
      });
      setData(updated);
      toast.success(`${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} settings saved`);
    } catch (err) {
      toast.error(`Could not save ${sectionName} settings`, err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!passwordForm.current_password) errs.current_password = "Enter your current password.";
    if (passwordForm.new_password.length < 8)
      errs.new_password = "New password must be at least 8 characters.";
    else if (!/[A-Za-z]/.test(passwordForm.new_password) || !/[0-9]/.test(passwordForm.new_password))
      errs.new_password = "Password must include at least one letter and one number.";
    if (passwordForm.new_password !== passwordForm.confirm_password)
      errs.confirm_password = "Passwords do not match.";

    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setChangingPassword(true);
    try {
      await api.post("/auth/change-password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success("Password updated successfully");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      toast.error("Could not change password", err instanceof Error ? err.message : undefined);
    } finally {
      setChangingPassword(false);
    }
  };

  const onLogoPick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 500_000) {
      toast.error("Logo must be under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCompanyForm((prev) => ({ ...prev, company_logo: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Manage company profile and configuration." />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const adminTabs = [
    { id: "company", label: "1. Company Profile" },
    { id: "staff", label: "2. Staff & User Management" },
    { id: "roles", label: "3. Roles & Permissions" },
    { id: "security", label: "4. Security & Authentication" },
    { id: "attendance", label: "5. Attendance Policy" },
    { id: "crm", label: "6. CRM Configuration" },
    { id: "notifications", label: "7. Notifications" },
    { id: "audit", label: "8. Audit Logs" },
    { id: "profile", label: "My Profile" },
  ];

  const staffTabs = [
    { id: "profile", label: "My Profile" },
    { id: "security", label: "Security & Password" },
  ];

  const activeTabs = isAdmin ? adminTabs : staffTabs;

  const auditColumns: Column<AuditLog>[] = [
    {
      key: "time",
      header: "Timestamp",
      render: (log) => (
        <span className="font-mono text-[11.5px] text-ink-600">
          {formatDate(log.created_at)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action / Event",
      render: (log) => (
        <span className="font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-[11.5px] border border-brand-100/80">
          {log.action}
        </span>
      ),
    },
    {
      key: "actor",
      header: "User",
      render: (log) => (
        <span className="text-[12px] font-medium text-ink-800">
          {log.actor ? log.actor.name : "System"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (log) => (
        <span className="text-[12px] text-ink-600 truncate max-w-xs block">
          {log.description}
        </span>
      ),
    },
    {
      key: "ip",
      header: "IP Address",
      render: (log) => (
        <span className="font-mono text-[11px] text-ink-400">
          {log.ip_address || "—"}
        </span>
      ),
    },
    {
      key: "details",
      header: "",
      className: "w-12 text-right",
      render: (log) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedAuditLog(log)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Administration"
        description="Configure organization details, access controls, security parameters and system audit trails."
        actions={<ModuleHelpButton moduleKey="settings" label="Settings Guide" />}
      />

      <Tabs items={activeTabs.map((t) => ({ key: t.id, label: t.label }))} value={tab} onChange={setTab} />

      {/* 1. Company Profile */}
      {tab === "company" && isAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Company Profile" subtitle="Public business branding and official contact details." />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Company Name" required>
                  <Input
                    value={companyForm.company_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                  />
                </Field>
                <Field label="Tagline">
                  <Input
                    value={companyForm.company_tagline}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_tagline: e.target.value })}
                  />
                </Field>
                <Field label="Official Email">
                  <Input
                    type="email"
                    value={companyForm.company_email}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_email: e.target.value })}
                  />
                </Field>
                <Field label="Phone Number">
                  <Input
                    value={companyForm.company_phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_phone: e.target.value })}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={companyForm.company_website}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_website: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Headquarters Address">
                <Textarea
                  rows={2}
                  value={companyForm.company_address}
                  onChange={(e) => setCompanyForm({ ...companyForm, company_address: e.target.value })}
                />
              </Field>

              <Field label="Proposal Footer Disclaimer">
                <Textarea
                  rows={2}
                  value={companyForm.proposal_footer}
                  onChange={(e) => setCompanyForm({ ...companyForm, proposal_footer: e.target.value })}
                />
              </Field>

              <div className="flex justify-end pt-2">
                <Button onClick={saveCompany} loading={saving}>
                  Save Company Profile
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Brand Mark / Logo" subtitle="Included on official proposal PDF exports." />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                {companyForm.company_logo ? (
                  <img
                    src={companyForm.company_logo}
                    alt="Logo"
                    className="h-16 w-16 rounded-xl border border-line object-contain p-1"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
                    SZ
                  </div>
                )}
                <div className="text-[12px] text-ink-500">
                  <p className="font-semibold text-ink-800">STACKZYRO Emblem</p>
                  <p className="text-[11px] text-ink-400">PNG, SVG or JPEG under 500 KB.</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogoPick(e.target.files?.[0])}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ImagePlus className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Logo
                </Button>
                {companyForm.company_logo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setCompanyForm({ ...companyForm, company_logo: "" })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* 2. Staff & User Management Section */}
      {tab === "staff" && isAdmin && (
        <StaffAccountManager inSettings={true} />
      )}

      {/* 3. Roles & Permissions Section */}
      {tab === "roles" && isAdmin && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="System Roles & Access Matrix"
              subtitle="Review standard authorization tiers and default module access rules."
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                  <div className="flex items-center gap-2 text-purple-900 font-semibold text-sm">
                    <ShieldCheck className="h-4 w-4 text-purple-600" />
                    Administrator Role
                  </div>
                  <p className="mt-1.5 text-xs text-purple-800 leading-relaxed">
                    Full unconstrained access to every company record, financial proposal, approval workflow, staff provisioning, system configuration, and compliance audit log.
                  </p>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <div className="flex items-center gap-2 text-brand-900 font-semibold text-sm">
                    <UserCheck className="h-4 w-4 text-brand-600" />
                    Staff Member Role
                  </div>
                  <p className="mt-1.5 text-xs text-brand-800 leading-relaxed">
                    Scoped access restricted strictly to assigned leads, calls, meetings, follow-ups, and individually assigned module permissions. Administrative sections and coworker private records are blocked.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* 4. Security & Authentication */}
      {tab === "security" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {isAdmin && (
            <Card>
              <CardHeader
                title="Authentication & Threat Controls"
                subtitle="Global password security parameters, rate limiting thresholds and session invalidation policies."
              />
              <CardBody className="space-y-4">
                <Field label="Max Failed Login Attempts (Lockout Trigger)">
                  <Input
                    type="number"
                    min={3}
                    max={10}
                    value={securitySettings.max_login_attempts}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, max_login_attempts: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Temporary Lockout Duration (Minutes)">
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={securitySettings.lockout_minutes}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, lockout_minutes: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Standard Session Timeout (Minutes)">
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    value={securitySettings.session_timeout_mins}
                    onChange={(e) =>
                      setSecuritySettings({ ...securitySettings, session_timeout_mins: Number(e.target.value) })
                    }
                  />
                </Field>

                <div className="rounded-xl border border-line bg-canvas p-3.5 text-xs text-ink-600 space-y-1">
                  <p className="font-semibold text-ink-900">Bcrypt Password Hashing & Salt Rounds</p>
                  <p className="text-[11px] text-ink-500">
                    Passwords are encrypted with 12 rounds of bcrypt. Hashes are never transmitted via API responses.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={() => saveSection("security", securitySettings)} loading={saving}>
                    Save Security Policies
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Change Own Password */}
          <Card className={!isAdmin ? "lg:col-span-2" : ""}>
            <CardHeader title="Change My Password" subtitle="Update your personal account credentials." />
            <CardBody>
              <form onSubmit={changePassword} className="space-y-4">
                <Field label="Current Password" required error={passwordErrors.current_password}>
                  <Input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  />
                </Field>
                <Field label="New Password" required error={passwordErrors.new_password}>
                  <Input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    placeholder="Min 8 characters (1 letter, 1 number)"
                  />
                </Field>
                <Field label="Confirm New Password" required error={passwordErrors.confirm_password}>
                  <Input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  />
                </Field>
                <div className="flex justify-end pt-2">
                  <Button type="submit" loading={changingPassword} leftIcon={<KeyRound className="h-4 w-4" />}>
                    Update Password
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      {/* 5. Attendance Settings */}
      {tab === "attendance" && isAdmin && (
        <Card className="max-w-2xl">
          <CardHeader
            title="Attendance & Working Hours Policy"
            subtitle="Configure official office timings, grace windows and half-day thresholds."
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Shift Start Time">
                <Input
                  type="time"
                  value={attendanceSettings.work_hours_start}
                  onChange={(e) =>
                    setAttendanceSettings({ ...attendanceSettings, work_hours_start: e.target.value })
                  }
                />
              </Field>
              <Field label="Shift End Time">
                <Input
                  type="time"
                  value={attendanceSettings.work_hours_end}
                  onChange={(e) =>
                    setAttendanceSettings({ ...attendanceSettings, work_hours_end: e.target.value })
                  }
                />
              </Field>
              <Field label="Grace Period (Minutes)">
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={attendanceSettings.grace_period_mins}
                  onChange={(e) =>
                    setAttendanceSettings({ ...attendanceSettings, grace_period_mins: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Half-Day Min Hours">
                <Input
                  type="number"
                  min={2}
                  max={6}
                  value={attendanceSettings.half_day_hours}
                  onChange={(e) =>
                    setAttendanceSettings({ ...attendanceSettings, half_day_hours: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => saveSection("attendance", attendanceSettings)} loading={saving}>
                Save Attendance Rules
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 6. CRM Configuration */}
      {tab === "crm" && isAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Pipeline & Localization" subtitle="Formatting, currencies, and reminders." />
            <CardBody className="space-y-4">
              <Field label="Primary Currency">
                <Select
                  value={preferences.currency}
                  onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="System Timezone">
                <Select
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                >
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Follow-up Reminder Window (Days Prior)">
                <Input
                  type="number"
                  min={0}
                  max={14}
                  value={preferences.followup_reminder_days}
                  onChange={(e) => setPreferences({ ...preferences, followup_reminder_days: e.target.value })}
                />
              </Field>
              <div className="flex justify-end pt-2">
                <Button onClick={savePreferences} loading={saving}>
                  Save Preferences
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Lead Operations" subtitle="Intake and workflow automation defaults." />
            <CardBody className="space-y-4">
              <Field label="Default Category for New Leads">
                <Input
                  value={crmConfig.default_lead_category}
                  onChange={(e) => setCrmConfig({ ...crmConfig, default_lead_category: e.target.value })}
                />
              </Field>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2.5 text-xs text-ink-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crmConfig.auto_assign_leads}
                    onChange={(e) => setCrmConfig({ ...crmConfig, auto_assign_leads: e.target.checked })}
                    className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600"
                  />
                  <span>Automatically assign unassigned leads round-robin</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-ink-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crmConfig.require_call_outcome}
                    onChange={(e) => setCrmConfig({ ...crmConfig, require_call_outcome: e.target.checked })}
                    className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600"
                  />
                  <span>Mandatory outcome selection when logging phone calls</span>
                </label>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => saveSection("crm", crmConfig)} loading={saving}>
                  Save CRM Config
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* 7. Notification Settings */}
      {tab === "notifications" && isAdmin && (
        <Card className="max-w-2xl">
          <CardHeader title="Notification Settings" subtitle="System alerts and activity digests." />
          <CardBody className="space-y-4">
            <div className="space-y-3.5">
              <label className="flex items-center gap-3 text-xs text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.email_alerts_enabled}
                  onChange={(e) => setNotifications({ ...notifications, email_alerts_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600"
                />
                <div>
                  <p className="font-semibold text-ink-900">Email System Alerts</p>
                  <p className="text-[11px] text-ink-400">Receive administrative notices on critical security events.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 text-xs text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.followup_reminder_email}
                  onChange={(e) => setNotifications({ ...notifications, followup_reminder_email: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600"
                />
                <div>
                  <p className="font-semibold text-ink-900">Follow-up Due Notifications</p>
                  <p className="text-[11px] text-ink-400">Alert staff when follow-up dates arrive.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 text-xs text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.daily_digest_email}
                  onChange={(e) => setNotifications({ ...notifications, daily_digest_email: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600"
                />
                <div>
                  <p className="font-semibold text-ink-900">Daily Pipeline Summary Digest</p>
                  <p className="text-[11px] text-ink-400">Email morning reports of daily call metrics and scheduled meetings.</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-line">
              <Button onClick={() => saveSection("notifications", notifications)} loading={saving}>
                Save Notification Preferences
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 8. Audit Logs */}
      {tab === "audit" && isAdmin && (
        <div className="space-y-4">
          <Card>
            <CardBody className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search action, description, IP..."
                    className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={auditCategory}
                    onChange={(e) => {
                      setAuditCategory(e.target.value);
                      setAuditPage(1);
                    }}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-[12.5px] text-ink-700 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="auth">Authentication & Logins</option>
                    <option value="staff">Staff Management</option>
                    <option value="lead">Leads</option>
                    <option value="call">Calls</option>
                    <option value="proposal">Proposals</option>
                    <option value="settings">Settings Changes</option>
                  </select>

                  <a href="/api/audit-logs/export" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
                      Export CSV
                    </Button>
                  </a>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <DataTable
              columns={auditColumns}
              rows={auditLogs?.items ?? []}
              rowKey={(log) => log.id}
              loading={auditLoading}
              emptyTitle="No audit records"
              emptyDescription="Audit records will be recorded as actions occur in the CRM."
            />
            {auditLogs && auditLogs.pages > 1 && (
              <Pagination
                page={auditPage}
                pages={auditLogs.pages}
                total={auditLogs.total}
                pageSize={10}
                onPage={setAuditPage}
              />
            )}
          </Card>
        </div>
      )}

      {/* My Profile */}
      {tab === "profile" && (
        <Card className="max-w-2xl">
          <CardHeader title="User Profile" subtitle="Your identity and personal information in STACKZYRO." />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4 pb-2 border-b border-line">
              <Avatar name={profileForm.name} size="lg" />
              <div>
                <p className="font-semibold text-ink-900 text-base">{profileForm.name}</p>
                <p className="text-xs text-ink-500">{user?.email} · {user?.staff_code}</p>
                <div className="mt-1">
                  <Badge tone={user?.role === "admin" ? "purple" : "grey"}>
                    {user?.role === "admin" ? "Administrator" : "Staff Member"}
                  </Badge>
                </div>
              </div>
            </div>

            <Field label="Full Name" required>
              <Input
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </Field>
            <Field label="Phone Number">
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </Field>
            <Field label="Designation">
              <Input
                value={profileForm.designation}
                onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
              />
            </Field>

            <div className="flex justify-end pt-2">
              <Button onClick={saveProfile} loading={saving}>
                Save Profile
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Audit Log Detail Modal */}
      <Modal
        open={Boolean(selectedAuditLog)}
        onClose={() => setSelectedAuditLog(null)}
        title="Audit Record Details"
        description={`Record #${selectedAuditLog?.id} · ${selectedAuditLog?.action}`}
        size="md"
      >
        {selectedAuditLog && (
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-ink-600 bg-canvas p-3 rounded-lg border border-line">
              <p>Actor: <span className="font-medium text-ink-900">{selectedAuditLog.actor?.name || "System"}</span></p>
              <p>Category: <span className="font-medium text-ink-900">{selectedAuditLog.category}</span></p>
              <p>Timestamp: <span className="font-medium text-ink-900">{formatDate(selectedAuditLog.created_at)}</span></p>
              <p>IP Address: <span className="font-mono text-ink-900">{selectedAuditLog.ip_address || "—"}</span></p>
            </div>

            <div>
              <p className="font-semibold text-ink-800 mb-1">Description</p>
              <p className="text-ink-600 bg-white p-2.5 rounded border border-line">{selectedAuditLog.description}</p>
            </div>

            {selectedAuditLog.previous_state && (
              <div>
                <p className="font-semibold text-ink-800 mb-1">Previous State</p>
                <pre className="p-2.5 rounded bg-slate-50 border border-line text-[11px] font-mono overflow-x-auto text-ink-700">
                  {JSON.stringify(selectedAuditLog.previous_state, null, 2)}
                </pre>
              </div>
            )}

            {selectedAuditLog.new_state && (
              <div>
                <p className="font-semibold text-ink-800 mb-1">New State</p>
                <pre className="p-2.5 rounded bg-slate-50 border border-line text-[11px] font-mono overflow-x-auto text-ink-700">
                  {JSON.stringify(selectedAuditLog.new_state, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedAuditLog(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

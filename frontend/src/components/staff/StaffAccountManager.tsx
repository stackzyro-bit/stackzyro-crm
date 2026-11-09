import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ActionMenu } from "../ui/ActionMenu";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Column, DataTable, Pagination } from "../ui/DataTable";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { Field, Input, Select } from "../ui/Input";
import { ModuleHelpButton } from "../help/ModuleHelpButton";
import { PageHeader } from "../ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useMeta } from "../../context/MetaContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import { cn, formatDate, toDateInput } from "../../lib/format";
import type { CrmModule, Paginated, User } from "../../lib/types";

const PAGE_SIZE = 10;

export const DEFAULT_MODULE_DEFINITIONS: CrmModule[] = [
  { key: "dashboard", label: "Dashboard", actions: ["view"] },
  { key: "leads", label: "Leads", actions: ["view", "create", "edit", "delete", "export", "assign"] },
  { key: "calls", label: "Call Management", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "followups", label: "Follow-ups", actions: ["view", "create", "edit", "delete"] },
  { key: "proposals", label: "Proposals", actions: ["view", "create", "edit", "delete", "export", "approve"] },
  { key: "meetings", label: "Meetings", actions: ["view", "create", "edit", "delete"] },
  { key: "clients", label: "Clients", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "attendance", label: "Attendance", actions: ["view", "create", "edit", "export"] },
  { key: "staff", label: "Staff Management", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "reports", label: "Reports", actions: ["view", "export"] },
  { key: "settings", label: "Settings", actions: ["view", "edit"] },
  { key: "audit_logs", label: "Audit Logs", actions: ["view", "export"] },
];

export const ROLE_PRESETS: Record<string, { label: string; perms: Record<string, string[]> }> = {
  office_assistant: {
    label: "Office Assistant",
    perms: {
      dashboard: ["view"],
      leads: ["view"],
      calls: ["view", "create"],
      followups: ["view", "create", "edit"],
      attendance: ["view", "create"],
      proposals: [],
      meetings: [],
      clients: [],
      staff: [],
      reports: [],
      settings: [],
      audit_logs: [],
    },
  },
  biz_dev: {
    label: "Business Development Assistant",
    perms: {
      dashboard: ["view"],
      leads: ["view", "create", "edit", "export"],
      calls: ["view", "create", "edit", "export"],
      followups: ["view", "create", "edit"],
      proposals: ["view", "create", "edit"],
      meetings: ["view", "create", "edit"],
      clients: ["view"],
      attendance: ["view", "create"],
      staff: [],
      reports: [],
      settings: [],
      audit_logs: [],
    },
  },
  web_dev: {
    label: "Web Development Assistant",
    perms: {
      dashboard: ["view"],
      leads: ["view"],
      proposals: ["view"],
      clients: ["view", "edit"],
      attendance: ["view", "create"],
      calls: [],
      followups: [],
      meetings: [],
      staff: [],
      reports: [],
      settings: [],
      audit_logs: [],
    },
  },
  digital_marketing: {
    label: "Digital Marketing Assistant",
    perms: {
      dashboard: ["view"],
      leads: ["view", "create", "export"],
      proposals: ["view"],
      reports: ["view", "export"],
      attendance: ["view", "create"],
      calls: [],
      followups: [],
      meetings: [],
      clients: [],
      staff: [],
      settings: [],
      audit_logs: [],
    },
  },
  standard: {
    label: "Standard Staff",
    perms: {
      dashboard: ["view"],
      leads: ["view", "create", "edit"],
      calls: ["view", "create"],
      followups: ["view", "create", "edit"],
      proposals: ["view", "create"],
      meetings: ["view", "create"],
      clients: ["view"],
      attendance: ["view", "create"],
      staff: [],
      reports: [],
      settings: [],
      audit_logs: [],
    },
  },
  full: {
    label: "Full Access (Admin)",
    perms: Object.fromEntries(DEFAULT_MODULE_DEFINITIONS.map((m) => [m.key, [...m.actions]])),
  },
  view_only: {
    label: "View Only",
    perms: Object.fromEntries(DEFAULT_MODULE_DEFINITIONS.map((m) => [m.key, m.actions.includes("view") ? ["view"] : []])),
  },
};

interface Performance {
  staff: User;
  leads: { total: number; by_status: Record<string, number> };
  calls: { total: number; last_30_days: number; by_outcome: Record<string, number> };
  followups: { total: number; completed: number; completion_rate: number };
  attendance: { present_days_last_30: number };
  proposals: number;
  clients: number;
  conversion_rate: number;
}

interface StaffFormState {
  name: string;
  username: string;
  email: string;
  phone: string;
  staff_code: string;
  designation: string;
  department: string;
  role: "admin" | "staff";
  status: "active" | "inactive" | "suspended";
  joined_on: string;
  temporary_password: string;
  confirm_temporary_password: string;
  must_change_password: boolean;
  permissions: Record<string, string[]>;
}

const EMPTY_FORM: StaffFormState = {
  name: "",
  username: "",
  email: "",
  phone: "",
  staff_code: "",
  designation: "Office Assistant",
  department: "Sales",
  role: "staff",
  status: "active",
  joined_on: toDateInput(),
  temporary_password: "",
  confirm_temporary_password: "",
  must_change_password: true,
  permissions: { ...ROLE_PRESETS.standard.perms },
};

export function StaffAccountManager({ inSettings = false }: { inSettings?: boolean }) {
  const { user: currentUser } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Created credentials modal (for secure handover)
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    email: string;
    tempPassword: string;
    mustChange: boolean;
  } | null>(null);

  // Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [confirmTempPassword, setConfirmTempPassword] = useState("");
  const [requirePwChange, setRequirePwChange] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Permissions Modal (Standalone permission manager)
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<User | null>(null);
  const [permState, setPermState] = useState<Record<string, string[]>>({});
  const [savingPerms, setSavingPerms] = useState(false);

  // Performance Drawer
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [performanceFor, setPerformanceFor] = useState<User | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Status toggle confirmation
  const [toggleTarget, setToggleTarget] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.get<Paginated<User>>("/staff", {
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
        status: status === "all" ? undefined : status,
        role: roleFilter === "all" ? undefined : roleFilter,
      });
      setData(payload);
    } catch (err) {
      toast.error("Could not load staff list", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, roleFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormOpen(true);
  };

  const openEdit = (member: User) => {
    setEditing(member);
    setForm({
      name: member.name,
      username: member.username || member.email.split("@")[0],
      email: member.email,
      phone: member.phone || "",
      staff_code: member.staff_code || "",
      designation: member.designation || "",
      department: member.department || "Sales",
      role: member.role,
      status: member.status || "active",
      joined_on: member.joined_on || toDateInput(),
      temporary_password: "",
      confirm_temporary_password: "",
      must_change_password: member.must_change_password ?? false,
      permissions: member.permissions || { ...ROLE_PRESETS.standard.perms },
    });
    setErrors({});
    setFormOpen(true);
  };

  const openPermissionsModal = (member: User) => {
    setPermTarget(member);
    setPermState(member.permissions || { ...ROLE_PRESETS.standard.perms });
    setPermModalOpen(true);
  };

  const savePermissionsModal = async () => {
    if (!permTarget) return;
    setSavingPerms(true);
    try {
      await api.patch(`/staff/${permTarget.id}`, {
        permissions: permState,
      });
      toast.success("Permissions updated", `Access rules updated for ${permTarget.name}.`);
      setPermModalOpen(false);
      void load();
    } catch (err) {
      toast.error("Could not save permissions", err instanceof Error ? err.message : undefined);
    } finally {
      setSavingPerms(false);
    }
  };

  const handlePermissionToggle = (modKey: string, action: string, inModal: boolean = false) => {
    if (inModal) {
      setPermState((prev) => {
        const cur = prev[modKey] || [];
        const next = cur.includes(action) ? cur.filter((a) => a !== action) : [...cur, action];
        return { ...prev, [modKey]: next };
      });
    } else {
      setForm((prev) => {
        const cur = prev.permissions[modKey] || [];
        const next = cur.includes(action) ? cur.filter((a) => a !== action) : [...cur, action];
        return {
          ...prev,
          permissions: {
            ...prev.permissions,
            [modKey]: next,
          },
        };
      });
    }
  };

  const applyPresetToState = (presetKey: string, inModal: boolean = false) => {
    const preset = ROLE_PRESETS[presetKey];
    if (!preset) return;
    if (inModal) {
      setPermState({ ...preset.perms });
    } else {
      setForm((prev) => ({
        ...prev,
        permissions: { ...preset.perms },
        designation: presetKey !== "full" && presetKey !== "view_only" && presetKey !== "standard"
          ? preset.label
          : prev.designation,
      }));
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Full name must be at least 2 characters.";
    
    // Username validation
    const usernameClean = form.username.trim().toLowerCase();
    if (usernameClean.length < 3) {
      errs.username = "Username must be at least 3 characters long.";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(usernameClean)) {
      errs.username = "Username can only contain letters, numbers, dots, and hyphens.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Enter a valid work email address.";
    }

    if (!editing) {
      if (form.temporary_password.length < 8) {
        errs.temporary_password = "Password must be at least 8 characters long.";
      } else if (!/[A-Za-z]/.test(form.temporary_password) || !/[0-9]/.test(form.temporary_password)) {
        errs.temporary_password = "Password must include at least one letter and one number.";
      }
      if (form.temporary_password !== form.confirm_temporary_password) {
        errs.confirm_temporary_password = "Passwords do not match.";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/staff/${editing.id}`, {
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          staff_code: form.staff_code.trim() || undefined,
          designation: form.designation.trim() || null,
          department: form.department.trim() || null,
          role: form.role,
          status: form.status,
          joined_on: form.joined_on || null,
          must_change_password: form.must_change_password,
          permissions: form.permissions,
        });
        toast.success("Staff profile updated", `${form.name}'s details and permissions were saved.`);
      } else {
        await api.post("/staff", {
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          staff_code: form.staff_code.trim() || undefined,
          designation: form.designation.trim() || null,
          department: form.department.trim() || null,
          role: form.role,
          status: form.status,
          joined_on: form.joined_on || null,
          temporary_password: form.temporary_password,
          confirm_temporary_password: form.confirm_temporary_password,
          must_change_password: form.must_change_password,
          permissions: form.permissions,
        });
        toast.success("Staff account created", `Account created with username @${form.username.trim().toLowerCase()}`);
        setCreatedCredentials({
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          tempPassword: form.temporary_password,
          mustChange: form.must_change_password,
        });
      }
      setFormOpen(false);
      void load();
    } catch (err) {
      toast.error("Failed to save staff member", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const onResetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (tempPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Za-z]/.test(tempPassword) || !/[0-9]/.test(tempPassword)) {
      toast.error("Password must contain at least one letter and one number.");
      return;
    }
    if (tempPassword !== confirmTempPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setResetting(true);
    try {
      const res = await api.post<{ message: string }>(`/staff/${resetTarget.id}/reset-password`, {
        temporary_password: tempPassword,
        require_password_change: requirePwChange,
      });
      toast.success("Password reset successfully", res.message);
      setResetModalOpen(false);
      setTempPassword("");
      setConfirmTempPassword("");
      void load();
    } catch (err) {
      toast.error("Could not reset password", err instanceof Error ? err.message : undefined);
    } finally {
      setResetting(false);
    }
  };

  const onToggleConfirm = async () => {
    if (!toggleTarget) return;
    setBusy(true);
    try {
      const updated = await api.post<User>(`/staff/${toggleTarget.id}/toggle-status`, {});
      toast.success(
        updated.status === "active" ? "Account activated" : "Account deactivated",
        `${updated.name}'s login access is now ${updated.status}.`
      );
      setToggleTarget(null);
      void load();
    } catch (err) {
      toast.error("Could not update account status", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const openPerformance = async (member: User) => {
    setPerformanceFor(member);
    setPerformanceLoading(true);
    try {
      const res = await api.get<Performance>(`/staff/${member.id}/performance`);
      setPerformance(res);
    } catch (err) {
      toast.error("Could not load performance stats", err instanceof Error ? err.message : undefined);
      setPerformanceFor(null);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const copyCredentialsText = () => {
    if (!createdCredentials) return;
    const appUrl = window.location.origin;
    const text =
      `STACKZYRO CRM — Staff Login Credentials\n\n` +
      `Employee: ${createdCredentials.name}\n` +
      `Username: ${createdCredentials.username}\n` +
      `Work Email: ${createdCredentials.email}\n` +
      `Initial Password: ${createdCredentials.tempPassword}\n` +
      `Login URL: ${appUrl}/login\n\n` +
      (createdCredentials.mustChange
        ? `* Note: You will be required to change your temporary password upon your first login.`
        : "");

    navigator.clipboard.writeText(text);
    toast.success("Credentials copied", "Login details copied to clipboard to provide securely to employee.");
  };

  // Staff Account Table Columns conforming strictly to:
  // | Employee | Username | Role | Account Status | Actions |
  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Employee",
      render: (member) => (
        <div className="flex items-center gap-3">
          <Avatar name={member.name} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ink-900 truncate">{member.name}</span>
              {member.role === "admin" && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-ink-400 truncate">
              {member.email} · <span className="font-mono text-ink-500 font-medium">{member.staff_code}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "username",
      header: "Username",
      render: (m) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
            @{m.username}
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(m.username);
              toast.success("Username copied", `@${m.username}`);
            }}
            title="Copy username"
            className="text-ink-400 hover:text-ink-700 p-0.5"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role / Designation",
      render: (m) => (
        <div>
          <p className="text-[12.5px] font-semibold text-ink-800">
            {m.designation || (m.role === "admin" ? "Administrator" : "Staff Member")}
          </p>
          <p className="text-[11px] text-ink-500">
            {m.department || "Operations"} · <span className="capitalize">{m.role}</span>
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Account Status",
      render: (m) => {
        const s = m.status || (m.is_active ? "active" : "inactive");
        if (s === "active") return <Badge tone="green" dot>Active</Badge>;
        if (s === "suspended") return <Badge tone="amber" dot>Suspended</Badge>;
        return <Badge tone="grey" dot>Inactive</Badge>;
      },
    },
    {
      key: "last_login",
      header: "Last Login",
      render: (m) => (
        <div>
          <p className="text-[11.5px] font-medium text-ink-700">
            {m.last_login_at ? formatDate(m.last_login_at) : "Never logged in"}
          </p>
          {m.must_change_password ? (
            <span className="text-[10px] text-amber-600 font-medium">Pending 1st Change</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-24 text-right",
      render: (m) => (
        <ActionMenu
          actions={[
            {
              label: "Edit Profile & Username",
              icon: Pencil,
              onClick: () => openEdit(m),
            },
            {
              label: "Reset Password (Temporary)",
              icon: KeyRound,
              onClick: () => {
                setResetTarget(m);
                setTempPassword("");
                setConfirmTempPassword("");
                setRequirePwChange(true);
                setShowResetPassword(false);
                setResetModalOpen(true);
              },
            },
            {
              label: "Module Permissions",
              icon: ShieldCheck,
              onClick: () => openPermissionsModal(m),
            },
            {
              label: m.status === "active" ? "Deactivate Account" : "Activate Account",
              icon: Power,
              danger: m.status === "active",
              disabled: m.id === currentUser?.id,
              onClick: () => setToggleTarget(m),
            },
            {
              label: "View Staff Performance",
              icon: BarChart3,
              onClick: () => openPerformance(m),
            },
          ]}
        />
      ),
    },
  ];

  const totalCount = data?.total ?? 0;
  const activeCount = (data?.items ?? []).filter((i) => i.status === "active").length;
  const inactiveCount = (data?.items ?? []).filter((i) => i.status !== "active").length;

  return (
    <div className="space-y-5">
      {!inSettings && (
        <PageHeader
          title="Staff & User Management"
          description="Provision employee login credentials, set manual usernames and initial passwords, manage module permissions, and control account lifecycles."
          actions={
            <div className="flex items-center gap-2">
              <ModuleHelpButton moduleKey="staff" label="Admin Staff Guide" />
              <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                Add Staff
              </Button>
            </div>
          }
        />
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-white p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Total Accounts</p>
          <p className="mt-1 text-2xl font-bold tabular text-ink-900">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Active Staff</p>
          <p className="mt-1 text-2xl font-bold tabular text-emerald-800">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Inactive / Suspended</p>
          <p className="mt-1 text-2xl font-bold tabular text-slate-700">{inactiveCount}</p>
        </div>
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Add Account</p>
            <p className="mt-0.5 text-xs text-ink-500">Provision credentials</p>
          </div>
          <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Add Staff
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardBody className="p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee name, username, email, ID..."
                className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-line bg-white px-3 text-[12.5px] text-ink-700 focus:border-brand-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-line bg-white px-3 text-[12.5px] text-ink-700 focus:border-brand-500 focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="staff">Staff Members</option>
              </select>
              {(search || status !== "all" || roleFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setRoleFilter("all");
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Staff Account Table */}
      <Card>
        <CardHeader
          title="Staff Account Directory"
          subtitle="Admin control over usernames, credentials, access tiers and login statuses"
          action={
            <Button size="sm" onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Add Staff
            </Button>
          }
        />
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(m) => m.id}
          loading={loading}
          emptyTitle="No staff members found"
          emptyDescription="Create a staff login account to provision credentials and module access."
        />
        {data && data.pages > 1 && (
          <Pagination
            page={page}
            pages={data.pages}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        )}
      </Card>

      {/* 1. ADD / EDIT STAFF MODAL */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Staff Account: ${editing.name}` : "Create Staff Login Account"}
        description={
          editing
            ? "Update employee username, contact details, status, or module permissions."
            : "Manually choose username and initial temporary password. Staff will be prompted to set their private password upon first login."
        }
        size="lg"
      >
        <form onSubmit={onSave} className="space-y-4 py-2">
          {/* Section 1: Employee Information */}
          <div className="rounded-xl border border-line bg-[#faf9fd] p-3.5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              1. Employee Profile Information
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Employee Full Name" required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ayesha Siddiqua"
                />
              </Field>

              <Field label="Work Email Address" required error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ayesha@stackzyro.com"
                />
              </Field>

              <Field label="Contact Phone Number">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </Field>

              <Field label="Employee ID / Staff Code">
                <Input
                  value={form.staff_code}
                  onChange={(e) => setForm({ ...form, staff_code: e.target.value })}
                  placeholder="e.g. ST-002 (or leave empty to auto-assign)"
                />
              </Field>

              <Field label="Designation">
                <Input
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="e.g. Office Assistant / Business Development"
                />
              </Field>

              <Field label="Department">
                <Select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                >
                  <option value="Sales">Sales & Business Development</option>
                  <option value="Marketing">Digital Marketing & Growth</option>
                  <option value="Engineering">Web & Software Development</option>
                  <option value="Operations">Operations & Administration</option>
                  <option value="Support">Customer Support</option>
                  <option value="Finance">Billing & Accounts</option>
                </Select>
              </Field>

              <Field label="Assigned Role">
                <Select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "staff" })}
                  disabled={editing?.id === currentUser?.id}
                >
                  <option value="staff">Staff Member (Restricted to Assigned Modules)</option>
                  <option value="admin">Administrator (Complete Company Oversight)</option>
                </Select>
              </Field>

              <Field label="Account Status">
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  disabled={editing?.id === currentUser?.id}
                >
                  <option value="active">Active (Permitted to log in)</option>
                  <option value="inactive">Inactive (Access blocked)</option>
                  <option value="suspended">Suspended (Temporarily disabled)</option>
                </Select>
              </Field>
            </div>
          </div>

          {/* Section 2: Credential Configuration */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-800">
                  2. Login Credentials (Set Manually by Admin)
                </p>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Choose a unique username and strong initial password for this employee.
                </p>
              </div>
              <KeyRound className="h-4 w-4 text-brand-600" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Username (Set manually by Admin)"
                required
                error={errors.username}
                className="sm:col-span-2"
              >
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  placeholder="e.g. staff001 or ayesha.sales"
                />
                <p className="mt-1 text-[10.5px] text-ink-400">
                  Must be unique. Staff can sign in using this username or their work email.
                </p>
              </Field>

              {!editing && (
                <>
                  <Field label="Password (Set manually by Admin)" required error={errors.temporary_password}>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={form.temporary_password}
                        onChange={(e) => setForm({ ...form, temporary_password: e.target.value })}
                        placeholder="Min 8 chars (letters & numbers)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>

                  <Field label="Confirm Password" required error={errors.confirm_temporary_password}>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirm_temporary_password}
                        onChange={(e) => setForm({ ...form, confirm_temporary_password: e.target.value })}
                        placeholder="Re-type password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                </>
              )}
            </div>

            <label className="flex items-center gap-2 pt-1 text-xs text-ink-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.must_change_password}
                onChange={(e) => setForm({ ...form, must_change_password: e.target.checked })}
                className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600"
              />
              <span className="font-medium">Force password change on next login</span>
              <span className="text-ink-400">(Recommended for secure credential onboarding)</span>
            </label>
          </div>

          {/* Section 3: Module Permissions Matrix */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-ink-700">
                  3. Module Permissions Matrix
                </p>
                <p className="text-[11px] text-ink-500">
                  Assign required module rights based on the employee's role.
                </p>
              </div>

              {/* Role Presets */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10.5px] font-medium text-ink-400 mr-1">Role Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPresetToState("office_assistant")}
                  className="rounded border border-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-ink-700 hover:bg-canvas"
                >
                  Office Assistant
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetToState("biz_dev")}
                  className="rounded border border-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-ink-700 hover:bg-canvas"
                >
                  Business Dev
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetToState("web_dev")}
                  className="rounded border border-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-ink-700 hover:bg-canvas"
                >
                  Web Dev
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetToState("digital_marketing")}
                  className="rounded border border-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-ink-700 hover:bg-canvas"
                >
                  Digital Marketing
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetToState("full")}
                  className="rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700 hover:bg-brand-100"
                >
                  Full Access
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line bg-white max-h-64 overflow-y-auto">
              <table className="w-full text-left text-[11.5px]">
                <thead className="sticky top-0 z-10 border-b border-line bg-[#faf9fd] text-[10.5px] font-semibold text-ink-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Module</th>
                    <th className="px-2 py-2 text-center">View</th>
                    <th className="px-2 py-2 text-center">Create</th>
                    <th className="px-2 py-2 text-center">Edit</th>
                    <th className="px-2 py-2 text-center">Delete</th>
                    <th className="px-2 py-2 text-center">Export</th>
                    <th className="px-2 py-2 text-center">Approve</th>
                    <th className="px-2 py-2 text-center">Assign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {DEFAULT_MODULE_DEFINITIONS.map((mod) => {
                    const assigned = form.permissions[mod.key] || [];
                    const hasAction = (a: string) => mod.actions.includes(a);
                    const isChecked = (a: string) => assigned.includes(a);

                    return (
                      <tr key={mod.key} className="hover:bg-brand-50/20">
                        <td className="px-3 py-1.5 font-medium text-ink-800">{mod.label}</td>
                        {["view", "create", "edit", "delete", "export", "approve", "assign"].map((act) => {
                          const permitted = hasAction(act);
                          if (!permitted) {
                            return (
                              <td key={act} className="px-2 py-1.5 text-center text-ink-200">
                                —
                              </td>
                            );
                          }
                          return (
                            <td key={act} className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked(act)}
                                onChange={() => handlePermissionToggle(mod.key, act, false)}
                                className="h-3.5 w-3.5 rounded border-line text-brand-600 accent-brand-600 cursor-pointer"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-line pt-3">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save Changes" : "Create Staff Account"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. CREATED CREDENTIALS HANDOVER DIALOG */}
      <Modal
        open={Boolean(createdCredentials)}
        onClose={() => setCreatedCredentials(null)}
        title="Staff Login Credentials Generated"
        description="Provide these login credentials to the employee securely. The password cannot be viewed again once this dialog is closed."
        size="md"
      >
        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Account Created Successfully
            </div>
            <p className="text-emerald-800">
              The employee account for <b>{createdCredentials?.name}</b> is ready. Passwords are encrypted with bcrypt and cannot be retrieved later.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-white p-4 space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1 border-b border-line">
              <span className="text-ink-500 font-sans">Username:</span>
              <span className="font-bold text-brand-800 select-all">{createdCredentials?.username}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-line">
              <span className="text-ink-500 font-sans">Work Email:</span>
              <span className="font-semibold text-ink-900 select-all">{createdCredentials?.email}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-line">
              <span className="text-ink-500 font-sans">Initial Password:</span>
              <span className="font-bold text-ink-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 select-all">
                {createdCredentials?.tempPassword}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-ink-500 font-sans">Next Action:</span>
              <span className="text-amber-700 font-sans text-[11px] font-semibold">
                Must change password on first login
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Copy className="h-3.5 w-3.5" />}
              onClick={copyCredentialsText}
            >
              Copy Credentials
            </Button>
            <Button onClick={() => setCreatedCredentials(null)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* 3. RESET PASSWORD MODAL */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`Reset Password: ${resetTarget?.name}`}
        description="Set a new temporary password manually. For security, previously set passwords cannot be viewed."
        size="sm"
      >
        <form onSubmit={onResetPasswordSubmit} className="space-y-4 py-2">
          <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3 text-xs text-brand-900">
            Username: <span className="font-mono font-bold">@{resetTarget?.username}</span>
          </div>

          <Field label="New Temporary Password (Set by Admin)" required>
            <div className="relative">
              <Input
                type={showResetPassword ? "text" : "password"}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Min 8 characters (1 letter, 1 number)"
                required
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              >
                {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Confirm Temporary Password" required>
            <Input
              type={showResetPassword ? "text" : "password"}
              value={confirmTempPassword}
              onChange={(e) => setConfirmTempPassword(e.target.value)}
              placeholder="Re-type new temporary password"
              required
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requirePwChange}
              onChange={(e) => setRequirePwChange(e.target.checked)}
              className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600"
            />
            <span className="font-medium">Force password change on next login</span>
          </label>

          <p className="text-[11px] text-ink-400 leading-relaxed">
            Submitting this form immediately revokes all active sessions for this account across all devices.
          </p>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" type="button" onClick={() => setResetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={resetting}>
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. PERMISSIONS MODAL */}
      <Modal
        open={permModalOpen}
        onClose={() => setPermModalOpen(false)}
        title={`Module Permissions: ${permTarget?.name}`}
        description="Fine-tune granular read, write, export, approve and assignment permissions."
        size="lg"
      >
        <div className="space-y-4 py-2">
          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-canvas border border-line">
            <span className="text-xs font-semibold text-ink-600 mr-1">Apply Role Preset:</span>
            {Object.entries(ROLE_PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPresetToState(key, true)}
                className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-white max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-line bg-[#faf9fd] text-[10.5px] font-semibold text-ink-600 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">Module</th>
                  <th className="px-2 py-2.5 text-center">View</th>
                  <th className="px-2 py-2.5 text-center">Create</th>
                  <th className="px-2 py-2.5 text-center">Edit</th>
                  <th className="px-2 py-2.5 text-center">Delete</th>
                  <th className="px-2 py-2.5 text-center">Export</th>
                  <th className="px-2 py-2.5 text-center">Approve</th>
                  <th className="px-2 py-2.5 text-center">Assign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {DEFAULT_MODULE_DEFINITIONS.map((mod) => {
                  const assigned = permState[mod.key] || [];
                  const hasAction = (a: string) => mod.actions.includes(a);
                  const isChecked = (a: string) => assigned.includes(a);

                  return (
                    <tr key={mod.key} className="hover:bg-brand-50/20">
                      <td className="px-3.5 py-2 font-medium text-ink-800">{mod.label}</td>
                      {["view", "create", "edit", "delete", "export", "approve", "assign"].map((act) => {
                        const permitted = hasAction(act);
                        if (!permitted) {
                          return (
                            <td key={act} className="px-2 py-2 text-center text-ink-200">
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={act} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked(act)}
                              onChange={() => handlePermissionToggle(mod.key, act, true)}
                              className="h-4 w-4 rounded border-line text-brand-600 accent-brand-600 cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-line">
            <Button variant="outline" onClick={() => setPermModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePermissionsModal} loading={savingPerms}>
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. ACTIVATE / DEACTIVATE CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={onToggleConfirm}
        loading={busy}
        destructive={toggleTarget?.status === "active"}
        title={toggleTarget?.status === "active" ? "Deactivate Staff Account?" : "Activate Staff Account?"}
        description={
          toggleTarget?.status === "active"
            ? `Deactivating ${toggleTarget?.name}'s account will immediately revoke their access and terminate all active sessions.`
            : `Activating ${toggleTarget?.name}'s account will restore their login ability with their existing permissions.`
        }
        confirmLabel={toggleTarget?.status === "active" ? "Deactivate" : "Activate"}
      />

      {/* 6. PERFORMANCE STATS DRAWER / MODAL */}
      <Modal
        open={Boolean(performanceFor)}
        onClose={() => setPerformanceFor(null)}
        title={`Staff Performance: ${performanceFor?.name}`}
        description="Comprehensive operational breakdown of assigned pipeline, calls, meetings and attendance."
        size="lg"
      >
        {performanceLoading || !performance ? (
          <div className="py-8 text-center text-ink-400 text-xs">Loading performance statistics…</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-line bg-canvas p-3">
                <p className="text-[10.5px] uppercase font-semibold text-ink-400">Assigned Leads</p>
                <p className="mt-1 text-xl font-bold tabular text-ink-900">{performance.leads.total}</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas p-3">
                <p className="text-[10.5px] uppercase font-semibold text-ink-400">Calls Logged</p>
                <p className="mt-1 text-xl font-bold tabular text-ink-900">{performance.calls.total}</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas p-3">
                <p className="text-[10.5px] uppercase font-semibold text-ink-400">Follow-up Rate</p>
                <p className="mt-1 text-xl font-bold tabular text-emerald-700">
                  {performance.followups.completion_rate}%
                </p>
              </div>
              <div className="rounded-xl border border-line bg-canvas p-3">
                <p className="text-[10.5px] uppercase font-semibold text-ink-400">Days Present (30d)</p>
                <p className="mt-1 text-xl font-bold tabular text-brand-700">
                  {performance.attendance.present_days_last_30}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-[#faf9fd] p-3.5 space-y-2 text-xs">
              <p className="font-semibold text-ink-800">Account Summary</p>
              <div className="grid grid-cols-2 gap-2 text-ink-600">
                <div>Username: <span className="font-mono font-medium text-ink-900">@{performance.staff.username}</span></div>
                <div>Role: <span className="font-medium text-ink-900">{performance.staff.designation}</span></div>
                <div>Status: <span className="font-medium capitalize text-ink-900">{performance.staff.status}</span></div>
                <div>Last Login: <span className="font-medium text-ink-900">{performance.staff.last_login_at ? formatDate(performance.staff.last_login_at) : "Never"}</span></div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setPerformanceFor(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

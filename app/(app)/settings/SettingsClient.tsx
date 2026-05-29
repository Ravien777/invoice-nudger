"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Trash2, Mail, UserX, Users } from "lucide-react";

import { currenciesWithSymbol } from "@/lib/format-currency";

import { PageShell } from "@/app/components/layout/PageShell";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import { FormField } from "@/app/components/ui/FormField";
import { Modal } from "@/app/components/ui/Modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Step {
  id?: string;
  daysOffset: number;
  emailTemplate: string;
}

interface Schedule {
  id: string;
  name: string;
  isDefault: boolean;
  steps: Step[];
}

interface Integration {
  id: string;
  platform: string;
  tenantId: string | null;
  connectedAt: Date;
  expiresAt: Date;
}

interface BillingData {
  plan: string;
  subscriptionStatus: string | null;
  tier: { name: string; invoiceLimit: number | null; priceCents: number };
  monthlyInvoiceCount: number;
}

interface AISettings {
  enabled: boolean;
  tone: string;
  usage: number;
  limit: number;
}

interface PortalBranding {
  businessName: string;
  logoUrl: string;
  accentColor: string;
  tagline: string;
  faviconUrl: string;
}

interface PortalSettings {
  enabled: boolean;
  branding: PortalBranding;
  hasAccess: boolean;
}

interface PromiseSettings {
  active: number;
  pending: number;
  expired: number;
  hasAccess: boolean;
}

interface NotificationChannelInfo {
  enabled: boolean;
  limit: number;
  used: number;
}

interface NotificationSettings {
  sms: NotificationChannelInfo;
  whatsapp: NotificationChannelInfo;
}

interface LateFeeSettings {
  enabled: boolean;
  type: string;
  value: number;
  frequency: string;
  interestEnabled: boolean;
  interestRate: number;
  graceDays: number;
  feeCap: number;
  hasAccess: boolean;
}

interface IndustrySettings {
  industry: string | null;
  benchmarksOptOut: boolean;
}

interface AccountantAccessItem {
  id: string;
  accountantEmail: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

interface TeamMemberItem {
  id: string;
  memberEmail: string;
  role: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  removedAt: string | null;
}

interface TeamSettings {
  members: TeamMemberItem[];
  hasAccess: boolean;
  tier: { name: string; teamSeats: number };
}

interface UserProfile {
  name: string | null;
  email: string;
  alertPreferences: Record<string, unknown>;
  taxRate: number;
  fiscalYearStart: number;
  taxSavingsAmount: number;
  baseCurrency: string;
  defaultHourlyRate: number;
  receiptEmail: string | null;
}

interface SettingsClientProps {
  schedule: Schedule | null;
  integrations: Integration[];
  billing: BillingData;
  aiSettings: AISettings;
  portalSettings: PortalSettings;
  promiseSettings: PromiseSettings;
  notificationSettings: NotificationSettings;
  lateFeeSettings: LateFeeSettings;
  industrySettings: IndustrySettings;
  userProfile: UserProfile;
  accountantAccess: AccountantAccessItem[];
  teamSettings: TeamSettings;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function offsetLabel(daysOffset: number): string {
  if (daysOffset < 0) return `${Math.abs(daysOffset)} days before due`;
  if (daysOffset === 0) return "On due date";
  return `${daysOffset} days after due`;
}

const platformConfig: Record<string, { label: string; color: string; icon: string }> = {
  xero: { label: "Xero", color: "#13B5EA", icon: "X" },
  quickbooks: { label: "QuickBooks", color: "#2CA01C", icon: "QB" },
};

type Tab = "profile" | "business" | "notifications" | "accountant" | "team" | "billing" | "danger";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabBtn({ onClick, active, children }: { onClick: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="md"
      onClick={onClick}
      className={active ? "bg-surface-primary text-text-primary shadow-sm" : ""}
    >
      {children}
    </Button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition flex-shrink-0 ${
        checked ? "bg-accent" : "bg-surface-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsClient({
  schedule,
  integrations: initialIntegrations,
  billing,
  aiSettings,
  portalSettings,
  promiseSettings,
  notificationSettings,
  lateFeeSettings,
  industrySettings,
  userProfile,
  accountantAccess: initialAccountantAccess,
  teamSettings,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile tab
  const [name, setName] = useState(userProfile.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [industry, setIndustry] = useState(industrySettings.industry ?? "");
  const [benchmarksOptOut, setBenchmarksOptOut] = useState(industrySettings.benchmarksOptOut);
  const [aiTone, setAiTone] = useState(aiSettings.tone);
  const [alertPrefs, setAlertPrefs] = useState<Record<string, unknown>>(userProfile.alertPreferences);
  const [savingIndustry, setSavingIndustry] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [taxRate, setTaxRate] = useState(Math.round(userProfile.taxRate * 100));
  const [fiscalYearStart, setFiscalYearStart] = useState(userProfile.fiscalYearStart);
  const [taxSavingsAmount, setTaxSavingsAmount] = useState(userProfile.taxSavingsAmount);
  const [baseCurrency, setBaseCurrency] = useState(userProfile.baseCurrency);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(userProfile.defaultHourlyRate ?? 0);
  const [savingTax, setSavingTax] = useState(false);

  // Notifications tab
  const [steps, setSteps] = useState<Step[]>(schedule?.steps ?? []);
  const [scheduleName, setScheduleName] = useState(schedule?.name ?? "Standard");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(aiSettings.enabled);
  const [savingAI, setSavingAI] = useState(false);

  // Business tab
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [portalEnabled, setPortalEnabled] = useState(portalSettings.enabled);
  const [branding, setBranding] = useState<PortalBranding>(portalSettings.branding);
  const [savingPortal, setSavingPortal] = useState(false);
  const [lateFeeEnabled, setLateFeeEnabled] = useState(lateFeeSettings.enabled);
  const [lateFeeType, setLateFeeType] = useState(lateFeeSettings.type);
  const [lateFeeValue, setLateFeeValue] = useState(lateFeeSettings.value);
  const [lateFeeFrequency, setLateFeeFrequency] = useState(lateFeeSettings.frequency);
  const [interestEnabled, setInterestEnabled] = useState(lateFeeSettings.interestEnabled);
  const [interestRate, setInterestRate] = useState(lateFeeSettings.interestRate);
  const [graceDays, setGraceDays] = useState(lateFeeSettings.graceDays);
  const [feeCap, setFeeCap] = useState(lateFeeSettings.feeCap);
  const [savingLateFees, setSavingLateFees] = useState(false);

  // Accountant Access tab
  const [accountantAccess, setAccountantAccess] = useState(initialAccountantAccess);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  // Team tab
  const [teamMembers, setTeamMembers] = useState(teamSettings.members);
  const [teamInviteEmail, setTeamInviteEmail] = useState("");
  const [teamInviteRole, setTeamInviteRole] = useState("member");
  const [sendingTeamInvite, setSendingTeamInvite] = useState(false);

  // Danger Zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("integrations");
    const platform = params.get("platform");
    const message = params.get("message");

    if (success === "success" && platform) {
      (async () => {
        toast.success(`${platformConfig[platform]?.label || platform} connected successfully`);
        window.history.replaceState({}, "", "/settings");
        try {
          const res = await fetch(`/api/integrations/${platform}/status`);
          const data = await res.json();
          if (data.connected) {
            setIntegrations((prev) => {
              const exists = prev.find((i) => i.platform === platform);
              if (exists) {
                return prev.map((i) =>
                  i.platform === platform ? { ...i, ...data } : i
                );
              }
              return [...prev, { ...data, platform, id: "" }];
            });
          }
        } catch {}
      })();
    } else if (success === "error") {
      toast.error(message || "Failed to connect");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const isConnected = (platform: string) =>
    integrations.some((i) => i.platform === platform);

  // -----------------------------------------------------------------------
  // Profile tab handlers
  // -----------------------------------------------------------------------

  async function handleSaveName() {
    setSavingName(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save name");
        return;
      }
      toast.success("Name saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveIndustry() {
    setSavingIndustry(true);
    try {
      const res = await fetch("/api/settings/industry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: industry || null,
          benchmarksOptOut,
        }),
      });
      if (res.ok) {
        toast.success("Industry settings saved");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingIndustry(false);
    }
  }

  async function handleSaveTax() {
    setSavingTax(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxRate, fiscalYearStart, taxSavingsAmount, baseCurrency, defaultHourlyRate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save tax settings");
        return;
      }
      toast.success("Tax settings saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingTax(false);
    }
  }

  async function handleSaveAlerts() {
    setSavingAlerts(true);
    try {
      const res = await fetch("/api/settings/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertPrefs),
      });
      if (res.ok) {
        toast.success("Alert preferences saved");
      } else {
        toast.error("Failed to save alert preferences");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingAlerts(false);
    }
  }

  // -----------------------------------------------------------------------
  // Notifications tab handlers
  // -----------------------------------------------------------------------

  function handleStepChange(index: number, field: "daysOffset" | "emailTemplate", value: string) {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: field === "daysOffset" ? parseInt(value, 10) || 0 : value,
      };
      return next;
    });
  }

  function handleAddStep() {
    setSteps((prev) => [...prev, { daysOffset: 0, emailTemplate: "" }]);
  }

  function handleRemoveStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveSchedule() {
    if (steps.length === 0) {
      toast.error("At least one step is required");
      return;
    }
    for (const step of steps) {
      if (!step.emailTemplate.trim()) {
        toast.error("All steps must have an email template name");
        return;
      }
    }
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/schedules/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: scheduleName, steps }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      toast.success("Schedule saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleSaveAISettings() {
    setSavingAI(true);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: aiEnabled, tone: aiTone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save AI settings");
        return;
      }
      toast.success("AI settings saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingAI(false);
    }
  }

  // -----------------------------------------------------------------------
  // Business tab handlers
  // -----------------------------------------------------------------------

  async function handleSavePortal() {
    setSavingPortal(true);
    try {
      const res = await fetch("/api/settings/portal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: portalEnabled, branding }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save portal settings");
        return;
      }
      toast.success("Portal settings saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingPortal(false);
    }
  }

  async function handleDisconnect(platform: string) {
    if (!confirm(`Disconnect ${platformConfig[platform]?.label || platform}?`)) return;
    try {
      const res = await fetch(`/api/integrations/${platform}/disconnect`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to disconnect");
        return;
      }
      setIntegrations((prev) => prev.filter((i) => i.platform !== platform));
      toast.success("Disconnected");
    } catch {
      toast.error("Network error");
    }
  }

  async function handleSync(platform: string) {
    setSyncing((prev) => ({ ...prev, [platform]: true }));
    try {
      const res = await fetch(`/api/integrations/${platform}/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed");
        return;
      }
      if (data.errors?.length > 0) {
        toast.error(`Sync completed with ${data.errors.length} error(s)`);
      } else {
        toast.success(`Synced: ${data.pulled} pulled, ${data.pushed} pushed`);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSyncing((prev) => ({ ...prev, [platform]: false }));
    }
  }

  async function handleSaveLateFees() {
    setSavingLateFees(true);
    try {
      const res = await fetch("/api/settings/late-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lateFeeEnabled,
          lateFeeType,
          lateFeeValue,
          lateFeeFrequency,
          interestEnabled,
          interestRate,
          lateFeeGraceDays: graceDays,
          feeCap,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save late fee settings");
        return;
      }
      toast.success("Late fee settings saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSavingLateFees(false);
    }
  }

  // -----------------------------------------------------------------------
  // Accountant Access handlers
  // -----------------------------------------------------------------------

  async function handleInviteAccountant() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setSendingInvite(true);
    try {
      const res = await fetch("/api/accountant/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send invite");
        return;
      }
      toast.success("Invitation sent");
      setInviteEmail("");
      setAccountantAccess((prev) => [
        {
          id: `local-${Date.now()}`,
          accountantEmail: inviteEmail.trim(),
          status: "pending",
          invitedAt: new Date().toISOString(),
          acceptedAt: null,
          revokedAt: null,
        },
        ...prev,
      ]);
    } catch {
      toast.error("Network error");
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleRevokeAccountant(id: string) {
    if (!confirm("Revoke this accountant's access?")) return;
    try {
      const res = await fetch(`/api/accountant/revoke?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to revoke access");
        return;
      }
      toast.success("Access revoked");
      setAccountantAccess((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "revoked", revokedAt: new Date().toISOString() } : a)),
      );
    } catch {
      toast.error("Network error");
    }
  }

  // ---------------------------------------------------------------------------
  // Team handlers
  // ---------------------------------------------------------------------------

  async function handleInviteTeamMember() {
    if (!teamInviteEmail || !teamInviteEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }

    setSendingTeamInvite(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: teamInviteEmail, role: teamInviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send invitation");
        return;
      }

      toast.success("Team invitation sent");
      setTeamInviteEmail("");
      setTeamMembers((prev) => [
        ...prev,
        {
          id: data.id || crypto.randomUUID(),
          memberEmail: teamInviteEmail,
          role: teamInviteRole,
          status: "pending",
          invitedAt: new Date().toISOString(),
          acceptedAt: null,
          removedAt: null,
        },
      ]);
    } catch {
      toast.error("Network error");
    } finally {
      setSendingTeamInvite(false);
    }
  }

  async function handleRemoveTeamMember(id: string) {
    if (!confirm("Remove this team member?")) return;
    try {
      const res = await fetch(`/api/team/${id}/remove`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove team member");
        return;
      }
      toast.success("Team member removed");
      setTeamMembers((prev) =>
        prev.map((tm) => (tm.id === id ? { ...tm, status: "removed", removedAt: new Date().toISOString() } : tm)),
      );
    } catch {
      toast.error("Network error");
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <PageShell title="Settings" subtitle="Manage your account and preferences">
      <div className="mb-6 flex gap-1 rounded-lg bg-surface-muted p-1 w-fit overflow-x-auto">
        <TabBtn onClick={() => setActiveTab("profile")} active={activeTab === "profile"}>Profile</TabBtn>
        <TabBtn onClick={() => setActiveTab("business")} active={activeTab === "business"}>Business</TabBtn>
        <TabBtn onClick={() => setActiveTab("notifications")} active={activeTab === "notifications"}>Notifications</TabBtn>
        <TabBtn onClick={() => setActiveTab("accountant")} active={activeTab === "accountant"}>Accountant</TabBtn>
        <TabBtn onClick={() => setActiveTab("team")} active={activeTab === "team"}>Team</TabBtn>
        <TabBtn onClick={() => setActiveTab("billing")} active={activeTab === "billing"}>Billing</TabBtn>
        <TabBtn onClick={() => setActiveTab("danger")} active={activeTab === "danger"}>Danger Zone</TabBtn>
      </div>

      {/* ================================================================= */}
      {/* PROFILE TAB */}
      {/* ================================================================= */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Personal Info */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Personal Info</h2>
            <div className="space-y-4 max-w-md">
              <FormField label="Name">
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
                  <Button onClick={handleSaveName} loading={savingName} size="sm">
                    Save
                  </Button>
                </div>
              </FormField>
              <FormField label="Email">
                <Input value={userProfile.email} readOnly />
              </FormField>
            </div>
          </div>

          {/* Industry & Benchmarks */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Industry & Benchmarks</h2>
            <div className="space-y-4 max-w-md">
              <FormField label="Your Industry" hint="Used to compare your payment collection against peers">
                <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">-- Select industry --</option>
                  <option value="freelance_design">Freelance Design</option>
                  <option value="software_dev">Software Development</option>
                  <option value="consulting">Consulting</option>
                  <option value="marketing_agency">Marketing Agency</option>
                  <option value="other">Other</option>
                </Select>
              </FormField>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted">Include in anonymous benchmarks</p>
                  <p className="text-xs text-muted mt-0.5">
                    Your data will be aggregated anonymously with other users
                  </p>
                </div>
                <Toggle checked={!benchmarksOptOut} onChange={(v) => setBenchmarksOptOut(!v)} />
              </div>
              <div className="pt-2">
                <Button onClick={handleSaveIndustry} loading={savingIndustry} size="sm">
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* AI Tone */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">AI Tone</h2>
            <div className="space-y-4 max-w-md">
              <FormField label="Default Tone" hint="Used when generating AI reminder emails">
                <Select value={aiTone} onChange={(e) => setAiTone(e.target.value)}>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="firm">Firm</option>
                  <option value="casual">Casual</option>
                </Select>
              </FormField>
              <div className="pt-2">
                <Button onClick={handleSaveAISettings} loading={savingAI} size="sm">
                  Save Tone
                </Button>
              </div>
            </div>
          </div>

          {/* Alert Preferences */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Alert Preferences</h2>
            <p className="text-sm text-muted mb-4">
              Choose which alerts you want to receive in your notification bell.
            </p>
            <div className="space-y-4 max-w-md">
              {[
                { key: "highRiskInvoices", label: "High-risk invoices", desc: "When a high-risk invoice is detected" },
                { key: "clientDeterioration", label: "Client deterioration", desc: "When a client's payment behaviour worsens" },
                { key: "cashFlowGap", label: "Cash flow gap", desc: "When a cash flow gap is detected" },
                { key: "weeklyDigest", label: "Weekly digest", desc: "Weekly summary of your account" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                  <Toggle
                    checked={!!alertPrefs[key]}
                    onChange={(v) => setAlertPrefs((p) => ({ ...p, [key]: v }))}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted">Cash flow threshold</p>
                  <p className="text-xs text-muted">Minimum gap ($) to trigger an alert</p>
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    value={(alertPrefs.cashFlowThreshold as number) ?? 1000}
                    onChange={(e) =>
                      setAlertPrefs((p) => ({ ...p, cashFlowThreshold: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleSaveAlerts} loading={savingAlerts} size="sm">
                  Save Alert Preferences
                </Button>
              </div>
            </div>
          </div>

          {/* Tax Settings */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Tax Settings</h2>
            <p className="text-sm text-muted mb-4">
              Used to estimate how much to set aside for taxes. Ask your accountant for the right numbers.
            </p>
            <div className="space-y-4 max-w-md">
              <FormField label="Your approximate tax rate (%)" hint="Used to calculate estimated tax on taxable income">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                />
              </FormField>
              <FormField label="Tax year starts in" hint="When your fiscal year begins (January for most)">
                <Select value={fiscalYearStart} onChange={(e) => setFiscalYearStart(Number(e.target.value))}>
                  {[
                    { n: 1, l: "January" }, { n: 2, l: "February" }, { n: 3, l: "March" },
                    { n: 4, l: "April" }, { n: 5, l: "May" }, { n: 6, l: "June" },
                    { n: 7, l: "July" }, { n: 8, l: "August" }, { n: 9, l: "September" },
                    { n: 10, l: "October" }, { n: 11, l: "November" }, { n: 12, l: "December" },
                  ].map((m) => (
                    <option key={m.n} value={m.n}>{m.l}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Base Currency" hint="Your default currency for new invoices and reports">
                <Select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
                  {currenciesWithSymbol().map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Default hourly rate ($)" hint="Used when creating invoices from time entries">
                <Input
                  type="number"
                  min="0"
                  value={defaultHourlyRate}
                  onChange={(e) => setDefaultHourlyRate(Number(e.target.value) || 0)}
                />
              </FormField>
              <div className="pt-2">
                <Button onClick={handleSaveTax} loading={savingTax} size="sm">
                  Save Tax Settings
                </Button>
              </div>
            </div>
          </div>

          {/* Receipt Email */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Receipt Email</h2>
            <p className="text-sm text-muted mb-4">
              Forward any receipt email to your unique address. We'll log it as an expense automatically.
            </p>
            {userProfile.receiptEmail ? (
              <div className="space-y-3 max-w-md">
                <div className="flex items-center gap-2">
                  <Input value={userProfile.receiptEmail} readOnly className="flex-1" />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(userProfile.receiptEmail ?? "");
                      toast.success("Email address copied");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted">
                  Send or forward receipt emails to this address. We'll extract the amount, vendor, and date, then create an expense record.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">Generating your receipt email address...</p>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BUSINESS TAB */}
      {/* ================================================================= */}
      {activeTab === "business" && (
        <div className="space-y-6">
          {/* Client Portal Branding */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Client Portal</h2>
            {!portalSettings.hasAccess ? (
              <div className="rounded-lg bg-[var(--warning-muted)] p-4">
                <p className="text-sm text-[var(--warning)]">
                  The client portal is not available on the Free plan. Upgrade to Pro or Agency to unlock this feature.
                </p>
                <Link
                  href="/settings/billing"
                  className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
                >
                  Upgrade Plan
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">Enable Client Portal</p>
                    <p className="text-xs text-muted mt-0.5">
                      Give clients a branded link to view invoices and make payments
                    </p>
                  </div>
                  <Toggle checked={portalEnabled} onChange={setPortalEnabled} />
                </div>

                {portalEnabled && (
                  <div className="space-y-4 max-w-md mb-6">
                    <FormField label="Business Name">
                      <Input
                        value={branding.businessName}
                        onChange={(e) => setBranding((p) => ({ ...p, businessName: e.target.value }))}
                      />
                    </FormField>
                    <FormField label="Logo URL">
                      <Input
                        value={branding.logoUrl}
                        onChange={(e) => setBranding((p) => ({ ...p, logoUrl: e.target.value }))}
                        placeholder="https://example.com/logo.png"
                      />
                    </FormField>
                    <FormField label="Accent Color">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={branding.accentColor}
                          onChange={(e) => setBranding((p) => ({ ...p, accentColor: e.target.value }))}
                          className="h-9 w-12 cursor-pointer rounded border border-border bg-surface"
                        />
                        <Input
                          value={branding.accentColor}
                          onChange={(e) => {
                            if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                              setBranding((p) => ({ ...p, accentColor: e.target.value }));
                            }
                          }}
                          placeholder="#2563eb"
                          className="w-28"
                        />
                      </div>
                    </FormField>
                    <FormField label="Tagline">
                      <Input
                        value={branding.tagline}
                        onChange={(e) => setBranding((p) => ({ ...p, tagline: e.target.value }))}
                        placeholder="e.g. Professional invoicing made simple"
                      />
                    </FormField>
                    <FormField label="Favicon URL">
                      <Input
                        value={branding.faviconUrl}
                        onChange={(e) => setBranding((p) => ({ ...p, faviconUrl: e.target.value }))}
                        placeholder="https://example.com/favicon.ico"
                      />
                    </FormField>
                  </div>
                )}

                <div className="pt-2">
                  <Button onClick={handleSavePortal} loading={savingPortal} size="sm">
                    Save Portal Settings
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Accounting Integrations */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Accounting Integrations</h2>
            <p className="text-sm text-muted mb-6">
              Sync invoices and payment status with your accounting software.
            </p>

            {Object.entries(platformConfig).length === 0 && (
              <div className="rounded-lg bg-surface-muted p-4 text-center">
                <p className="text-sm text-muted">No integrations available yet.</p>
              </div>
            )}

            {Object.entries(platformConfig).map(([platform, config]) => {
              const connected = isConnected(platform);
              const integration = integrations.find((i) => i.platform === platform);
              return (
                <div key={platform} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: config.color }}
                    >
                      {config.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{config.label}</p>
                      {connected ? (
                        <p className="text-xs text-muted">
                          Connected{integration?.connectedAt ? ` since ${new Date(integration.connectedAt).toLocaleDateString()}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-muted">Not connected</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connected ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleSync(platform)} loading={syncing[platform]}>
                          Sync
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDisconnect(platform)}>
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <a
                        href={`/api/integrations/${platform}/connect`}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
                      >
                        Connect
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Late Fees */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Late Fees & Interest</h2>
            {!lateFeeSettings.hasAccess ? (
              <div className="rounded-lg bg-[var(--warning-muted)] p-4">
                <p className="text-sm text-[var(--warning)]">
                  Late fees and interest are not available on the Free plan. Upgrade to Pro or Agency to unlock this feature.
                </p>
                <Link
                  href="/settings/billing"
                  className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
                >
                  Upgrade Plan
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">Enable Late Fees & Interest</p>
                    <p className="text-xs text-muted mt-0.5">
                      Automatically apply fees to overdue invoices
                    </p>
                  </div>
                  <Toggle checked={lateFeeEnabled} onChange={setLateFeeEnabled} />
                </div>

                {lateFeeEnabled && (
                  <div className="space-y-4 max-w-md">
                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                      <h3 className="text-sm font-medium text-foreground mb-3">Late Fee</h3>
                      <div className="space-y-3">
                        <FormField label="Type">
                          <Select value={lateFeeType} onChange={(e) => setLateFeeType(e.target.value)}>
                            <option value="fixed">Fixed amount</option>
                            <option value="percentage">Percentage of invoice</option>
                          </Select>
                        </FormField>
                        <FormField label={lateFeeType === "fixed" ? "Amount" : "Percentage"}>
                          <Input
                            type="number"
                            value={lateFeeValue || ""}
                            onChange={(e) => setLateFeeValue(parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            prefix={lateFeeType === "fixed" ? "$" : "%"}
                          />
                        </FormField>
                        <FormField label="Frequency">
                          <Select value={lateFeeFrequency} onChange={(e) => setLateFeeFrequency(e.target.value)}>
                            <option value="once">One-time</option>
                            <option value="recurring">Recurring</option>
                          </Select>
                        </FormField>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                      <h3 className="text-sm font-medium text-foreground mb-3">Daily Interest</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted">Enable Daily Interest</p>
                          <Toggle checked={interestEnabled} onChange={setInterestEnabled} />
                        </div>
                        {interestEnabled && (
                          <FormField label="Daily Rate (%)" hint="e.g. 0.05% = ~18.25% APR">
                            <Input
                              type="number"
                              value={interestRate || ""}
                              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                              step="0.01"
                              min="0"
                              prefix="%"
                            />
                          </FormField>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                      <h3 className="text-sm font-medium text-foreground mb-3">General</h3>
                      <div className="space-y-3">
                        <FormField label="Grace Period (days)">
                          <Input
                            type="number"
                            value={graceDays || ""}
                            onChange={(e) => setGraceDays(parseInt(e.target.value) || 0)}
                            min="0"
                          />
                        </FormField>
                        <FormField label="Maximum Fee Cap ($)" hint="0 = no limit">
                          <Input
                            type="number"
                            value={feeCap || ""}
                            onChange={(e) => setFeeCap(parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            prefix="$"
                          />
                        </FormField>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[var(--warning-muted)] bg-[var(--warning-muted)]/50 p-4">
                      <p className="text-xs text-muted">
                        <span className="font-medium text-foreground">Disclaimer:</span> This is not legal advice. Late fees, interest, and collections practices are subject to applicable laws. Consult a legal professional.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border mt-6">
                  <Button onClick={handleSaveLateFees} loading={savingLateFees} size="sm">
                    Save Late Fee Settings
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Promise Detection */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">AI Promise Detection</h2>
            {!promiseSettings.hasAccess ? (
              <p className="text-sm text-muted">Not available on the Free plan.</p>
            ) : (
              <>
                <p className="text-sm text-muted mb-4">
                  Automatically detect when clients promise to pay via email.
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-md">
                  <div className="rounded-lg bg-surface-muted p-3 text-center">
                    <p className="text-xl font-bold text-[var(--success)]">{promiseSettings.active}</p>
                    <p className="text-xs text-muted">Active</p>
                  </div>
                  <div className="rounded-lg bg-surface-muted p-3 text-center">
                    <p className="text-xl font-bold text-[var(--warning)]">{promiseSettings.pending}</p>
                    <p className="text-xs text-muted">Pending</p>
                  </div>
                  <div className="rounded-lg bg-surface-muted p-3 text-center">
                    <p className="text-xl font-bold text-muted">{promiseSettings.expired}</p>
                    <p className="text-xs text-muted">Expired</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* NOTIFICATIONS TAB */}
      {/* ================================================================= */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          {/* Reminder Schedule */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Reminder Schedule</h2>

            <div className="mb-6 max-w-xs">
              <FormField label="Schedule Name">
                <Input
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                />
              </FormField>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted">Steps</h3>
                <Button variant="secondary" size="sm" onClick={handleAddStep}>
                  + Add Step
                </Button>
              </div>

              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={step.id ?? index}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:items-center"
                  >
                    <span className="w-6 text-center text-sm font-medium text-muted mt-1.5 sm:mt-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Days offset">
                        <Input
                          type="number"
                          value={step.daysOffset}
                          onChange={(e) => handleStepChange(index, "daysOffset", e.target.value)}
                        />
                      </FormField>
                      <FormField label="Timing">
                        <Input
                          value={offsetLabel(step.daysOffset)}
                          readOnly
                        />
                      </FormField>
                    </div>
                    <div className="flex-1">
                      <FormField label="Email template">
                        <Input
                          value={step.emailTemplate}
                          onChange={(e) => handleStepChange(index, "emailTemplate", e.target.value)}
                          placeholder="e.g. gentle_reminder"
                        />
                      </FormField>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 mt-5"
                      onClick={() => handleRemoveStep(index)}
                      disabled={steps.length <= 1}
                      icon={Trash2}
                      title="Remove step"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <Button onClick={handleSaveSchedule} loading={savingSchedule} size="sm">
                Save Schedule
              </Button>
            </div>
          </div>

          {/* AI Reminders */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">AI Reminders</h2>
            {aiSettings.limit === 0 ? (
              <div className="rounded-lg bg-[var(--warning-muted)] p-4">
                <p className="text-sm text-[var(--warning)]">
                  AI reminders are not available on the Free plan.
                </p>
                <Link
                  href="/settings/billing"
                  className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
                >
                  Upgrade Plan
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-muted">Enable AI Reminders</p>
                    <p className="text-xs text-muted mt-0.5">
                      Generate personalized reminder emails for each invoice
                    </p>
                  </div>
                  <Toggle checked={aiEnabled} onChange={setAiEnabled} />
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted">Monthly usage: {aiSettings.usage} / {aiSettings.limit}</span>
                    <span className="font-medium text-foreground">
                      {Math.round((aiSettings.usage / aiSettings.limit) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        aiSettings.usage >= aiSettings.limit
                          ? "bg-[var(--danger)]"
                          : (aiSettings.usage / aiSettings.limit) * 100 > 80
                          ? "bg-[var(--warning)]"
                          : "bg-purple-600"
                      }`}
                      style={{ width: `${Math.min((aiSettings.usage / aiSettings.limit) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button onClick={handleSaveAISettings} loading={savingAI} size="sm">
                    Save AI Settings
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* SMS & WhatsApp */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">SMS & WhatsApp</h2>
            {!notificationSettings.sms.enabled && !notificationSettings.whatsapp.enabled ? (
              <div className="rounded-lg bg-[var(--warning-muted)] p-4">
                <p className="text-sm text-[var(--warning)]">
                  SMS and WhatsApp reminders are not available on the Free plan.
                </p>
                <Link
                  href="/settings/billing"
                  className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
                >
                  Upgrade Plan
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 max-w-md">
                {(["sms", "whatsapp"] as const).map((channel) => {
                  const info = notificationSettings[channel];
                  return (
                    <div key={channel} className="rounded-lg bg-surface-muted p-4">
                      <p className="text-sm font-medium text-foreground capitalize mb-2">{channel}</p>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted">
                          {info.used} / {info.limit}
                        </span>
                        <span className="font-medium text-foreground">
                          {info.limit > 0 ? Math.round((info.used / info.limit) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full transition-all ${
                            info.used >= info.limit
                              ? "bg-[var(--danger)]"
                              : info.limit > 0 && (info.used / info.limit) * 100 > 80
                              ? "bg-[var(--warning)]"
                              : "bg-accent"
                          }`}
                          style={{ width: `${info.limit > 0 ? Math.min((info.used / info.limit) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <details className="mt-4">
              <summary className="text-sm text-muted cursor-pointer hover:text-foreground">
                Configuration reference
              </summary>
              <pre className="mt-3 text-xs text-muted bg-surface-muted rounded-lg p-3 overflow-x-auto">
{`TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+12025551234
TWILIO_WHATSAPP_NUMBER=+14155238886`}
              </pre>
            </details>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* ACCOUNTANT ACCESS TAB */}
      {/* ================================================================= */}
      {activeTab === "accountant" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Accountant Access</h2>
            <p className="text-sm text-muted mb-6">
              Invite your accountant or bookkeeper to view your account in read-only mode.
            </p>

            {/* Invite form */}
            <div className="mb-6 max-w-md">
              <label className="block text-sm font-medium text-muted mb-2">Accountant email</label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="accountant@example.com"
                  className="flex-1"
                />
                <Button onClick={handleInviteAccountant} loading={sendingInvite} size="sm">
                  Send Invite
                </Button>
              </div>
            </div>

            {/* Access list */}
            {accountantAccess.length === 0 ? (
              <div className="rounded-lg bg-surface-muted p-6 text-center">
                <Mail className="mx-auto h-8 w-8 text-muted mb-3" />
                <p className="text-sm text-muted">No accountants invited yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {accountantAccess.map((access) => (
                  <div
                    key={access.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-muted p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{access.accountantEmail}</p>
                        <p className="text-xs text-muted">
                          {access.status === "active" && "Active"}
                          {access.status === "pending" && "Invitation sent"}
                          {access.status === "revoked" && `Revoked${access.revokedAt ? ` on ${new Date(access.revokedAt).toLocaleDateString()}` : ""}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          access.status === "active"
                            ? "bg-[var(--success-muted)] text-[var(--success)]"
                            : access.status === "pending"
                            ? "bg-[var(--warning-muted)] text-[var(--warning)]"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {access.status}
                      </span>
                      {access.status !== "revoked" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5"
                          onClick={() => handleRevokeAccountant(access.id)}
                          icon={UserX}
                          title="Revoke access"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TEAM TAB */}
      {/* ================================================================= */}
      {activeTab === "team" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Team Members</h2>

            {teamSettings.hasAccess ? (
              <>
                <p className="text-sm text-muted mb-6">
                  Invite team members to your account. Members can create and edit invoices,
                  expenses, and time entries. Viewers have read-only access.
                </p>

                {/* Seat count */}
                <p className="text-xs text-muted mb-4">
                  {teamMembers.filter((m) => m.status !== "removed").length + 1} of{" "}
                  {teamSettings.tier.teamSeats} seats used (you count as 1)
                </p>

                {/* Invite form */}
                <div className="mb-6 max-w-md space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Email address</label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={teamInviteEmail}
                        onChange={(e) => setTeamInviteEmail(e.target.value)}
                        placeholder="teammate@example.com"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-muted mb-2">Role</label>
                      <select
                        value={teamInviteRole}
                        onChange={(e) => setTeamInviteRole(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                      >
                        <option value="member">Member (can create & edit)</option>
                        <option value="viewer">Viewer (read-only)</option>
                      </select>
                    </div>
                    <Button onClick={handleInviteTeamMember} loading={sendingTeamInvite} size="sm">
                      Send Invite
                    </Button>
                  </div>
                </div>

                {/* Member list */}
                {teamMembers.length === 0 ? (
                  <div className="rounded-lg bg-surface-muted p-6 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted mb-3" />
                    <p className="text-sm text-muted">No team members yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-surface-muted p-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{member.memberEmail}</p>
                            <p className="text-xs text-muted">
                              Role: <span className="capitalize">{member.role}</span>
                              {" — "}
                              {member.status === "active" && "Active"}
                              {member.status === "pending" && "Invitation sent"}
                              {member.status === "removed" && `Removed${member.removedAt ? ` on ${new Date(member.removedAt).toLocaleDateString()}` : ""}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.status === "active"
                                ? "bg-[var(--success-muted)] text-[var(--success)]"
                                : member.status === "pending"
                                ? "bg-[var(--warning-muted)] text-[var(--warning)]"
                                : "bg-surface-muted text-muted"
                            }`}
                          >
                            {member.status}
                          </span>
                          {member.status !== "removed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5"
                              onClick={() => handleRemoveTeamMember(member.id)}
                              icon={UserX}
                              title="Remove member"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg bg-surface-muted p-6 text-center">
                <Users className="mx-auto h-8 w-8 text-muted mb-3" />
                <p className="text-sm text-muted mb-4">
                  Team members are available on the Agency plan.
                </p>
                <Link href="/settings/billing">
                  <Button variant="primary" size="sm">
                    Upgrade to Agency
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BILLING TAB */}
      {/* ================================================================= */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Current Plan: {billing.tier.name}
                </h2>
                {billing.subscriptionStatus && (
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      billing.subscriptionStatus === "active"
                        ? "bg-[var(--success-muted)] text-[var(--success)]"
                        : billing.subscriptionStatus === "past_due"
                        ? "bg-[var(--warning-muted)] text-[var(--warning)]"
                        : "bg-surface-muted text-muted"
                    }`}
                  >
                    {billing.subscriptionStatus}
                  </span>
                )}
              </div>
            </div>

            {billing.tier.invoiceLimit !== null ? (
              <div className="mb-4 max-w-sm">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted">
                    Monthly usage: {billing.monthlyInvoiceCount} / {billing.tier.invoiceLimit} invoices
                  </span>
                  <span className="font-medium text-foreground">
                    {Math.round((billing.monthlyInvoiceCount / billing.tier.invoiceLimit) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      billing.monthlyInvoiceCount >= billing.tier.invoiceLimit
                        ? "bg-[var(--danger)]"
                        : (billing.monthlyInvoiceCount / billing.tier.invoiceLimit) * 100 > 80
                        ? "bg-[var(--warning)]"
                        : "bg-[var(--success)]"
                    }`}
                    style={{ width: `${Math.min((billing.monthlyInvoiceCount / billing.tier.invoiceLimit) * 100, 100)}%` }}
                  />
                </div>
                {billing.monthlyInvoiceCount >= billing.tier.invoiceLimit && (
                  <p className="mt-2 text-sm text-[var(--danger)]">
                    Invoice limit reached.{" "}
                    <Link href="/settings/billing" className="font-medium underline hover:text-foreground">
                      Upgrade your plan
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted mb-4">Unlimited invoices this month.</p>
            )}

            <div className="flex gap-3">
              <Link
                href="/settings/billing"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
              >
                Manage Billing
              </Link>
              {billing.subscriptionStatus === "active" && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/stripe/create-portal-session", { method: "POST" });
                      const data = await res.json();
                      if (res.ok && data.url) {
                        window.location.href = data.url;
                      } else {
                        toast.error(data.error || "Failed to open portal");
                      }
                    } catch {
                      toast.error("Network error");
                    }
                  }}
                >
                   Manage Subscription
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DANGER ZONE TAB */}
      {/* ================================================================= */}
      {activeTab === "danger" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-danger/30 bg-surface p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-foreground">Danger Zone</h2>
            <p className="text-sm text-muted mb-6">
              Irreversible actions. Proceed with caution.
            </p>

            <div className="rounded-lg border border-danger/20 bg-danger/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete Account</p>
                  <p className="text-xs text-muted mt-0.5">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
        title="Delete Account"
        description="This action cannot be undone. All your data will be permanently deleted."
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleteConfirm !== "DELETE"}
              onClick={() => {
                toast.error("Account deletion is not yet implemented. Contact support.");
                setShowDeleteModal(false);
                setDeleteConfirm("");
              }}
            >
              Confirm Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted mb-4">
          Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm.
        </p>
        <Input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder="Type DELETE"
          className="font-mono"
        />
      </Modal>
    </PageShell>
  );
}

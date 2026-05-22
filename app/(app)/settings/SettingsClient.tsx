"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

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
  tier: {
    name: string;
    invoiceLimit: number | null;
    priceCents: number;
  };
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

interface SettingsClientProps {
  schedule: Schedule | null;
  integrations: Integration[];
  billing: BillingData;
  aiSettings: AISettings;
  portalSettings: PortalSettings;
  promiseSettings: PromiseSettings;
  notificationSettings: NotificationSettings;
  lateFeeSettings: LateFeeSettings;
}

type Tab = "reminders" | "integrations" | "billing" | "ai" | "portal" | "promises" | "notifications" | "late-fees";

function offsetLabel(daysOffset: number): string {
  if (daysOffset < 0) return `${Math.abs(daysOffset)} days before due`;
  if (daysOffset === 0) return "On due date";
  return `${daysOffset} days after due`;
}

const platformConfig: Record<string, { label: string; color: string; icon: string }> = {
  xero: { label: "Xero", color: "#13B5EA", icon: "X" },
  quickbooks: { label: "QuickBooks", color: "#2CA01C", icon: "QB" },
};

export default function SettingsClient({ schedule, integrations: initialIntegrations, billing, aiSettings, portalSettings, promiseSettings, notificationSettings, lateFeeSettings }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("reminders");
  const [steps, setSteps] = useState<Step[]>(schedule?.steps ?? []);
  const [name, setName] = useState(schedule?.name ?? "Standard");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [aiEnabled, setAiEnabled] = useState(aiSettings.enabled);
  const [aiTone, setAiTone] = useState(aiSettings.tone);
  const [savingAI, setSavingAI] = useState(false);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("integrations");
    const platform = params.get("platform");
    const message = params.get("message");

    if (success === "success" && platform) {
      toast.success(`${platformConfig[platform]?.label || platform} connected successfully`);
      window.history.replaceState({}, "", "/settings");
      fetchIntegrationStatus(platform);
    } else if (success === "error") {
      toast.error(message || "Failed to connect");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  async function fetchIntegrationStatus(platform: string) {
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
    } catch {
    }
  }

  function handleStepChange(
    index: number,
    field: "daysOffset" | "emailTemplate",
    value: string,
  ) {
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

  async function handleSave() {
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

    setSaving(true);

    try {
      const res = await fetch("/api/schedules/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, steps }),
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
      setSaving(false);
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

  async function handleSavePortalSettings() {
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

  const isConnected = (platform: string) =>
    integrations.some((i) => i.platform === platform);

  if (!schedule) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="text-muted">No default reminder schedule found.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="mb-6 flex gap-1 rounded-lg bg-surface-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab("reminders")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "reminders"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Reminders
        </button>
        <button
          onClick={() => setActiveTab("integrations")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "integrations"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setActiveTab("billing")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "billing"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Billing
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "ai"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          AI Reminders
        </button>
        <button
          onClick={() => setActiveTab("portal")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "portal"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Client Portal
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "notifications"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveTab("promises")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "promises"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Promise Detection
          {promiseSettings.pending > 0 && (
            <span className="ml-1.5 inline-block h-4 w-4 rounded-full bg-[var(--warning)] text-[10px] font-bold text-white leading-4 text-center">
              {promiseSettings.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("late-fees")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "late-fees"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Late Fees
        </button>
      </div>

      {activeTab === "reminders" && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Default Reminder Schedule
          </h2>

          <div className="mb-6">
            <label
              htmlFor="scheduleName"
              className="block text-sm font-medium text-muted"
            >
              Schedule Name
            </label>
            <input
              type="text"
              id="scheduleName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted">Steps</h3>
              <button
                onClick={handleAddStep}
                className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
              >
                + Add Step
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id ?? index}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted p-3"
                >
                  <span className="w-8 text-center text-sm font-medium text-muted">
                    {index + 1}
                  </span>

                  <div className="w-36">
                    <label className="block text-xs text-muted">
                      Days offset
                    </label>
                    <input
                      type="number"
                      value={step.daysOffset}
                      onChange={(e) =>
                        handleStepChange(index, "daysOffset", e.target.value)
                      }
                      className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div className="w-40">
                    <label className="block text-xs text-muted">Timing</label>
                    <p className="mt-0.5 text-sm text-foreground">
                      {offsetLabel(step.daysOffset)}
                    </p>
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs text-muted">
                      Email template
                    </label>
                    <input
                      type="text"
                      value={step.emailTemplate}
                      onChange={(e) =>
                        handleStepChange(index, "emailTemplate", e.target.value)
                      }
                      placeholder="e.g. gentle_reminder"
                      className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <button
                    onClick={() => handleRemoveStep(index)}
                    disabled={steps.length <= 1}
                    className="mt-4 rounded-lg p-1.5 text-muted transition hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
                    title="Remove step"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "integrations" && (
        <div className="space-y-6">
          {Object.entries(platformConfig).map(([platform, config]) => {
            const connected = isConnected(platform);
            const integration = integrations.find((i) => i.platform === platform);

            return (
              <div
                key={platform}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
                      style={{ backgroundColor: config.color }}
                    >
                      {config.icon}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {config.label}
                      </h2>
                      {connected ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-success" />
                          <span className="text-sm text-muted">
                            Connected
                            {integration?.connectedAt && (
                              <span className="ml-1">
                                since{" "}
                                {new Date(integration.connectedAt).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted">
                          Sync invoices and payment status with {config.label}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {connected ? (
                      <>
                        <button
                          onClick={() => handleSync(platform)}
                          disabled={syncing[platform]}
                          className="rounded-lg bg-surface px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                        >
                          {syncing[platform] ? "Syncing..." : "Sync Now"}
                        </button>
                        <button
                          onClick={() => handleDisconnect(platform)}
                          className="rounded-lg bg-surface px-3 py-2 text-sm font-medium text-danger ring-1 ring-border transition hover:bg-surface-muted"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <a
                        href={`/api/integrations/${platform}/connect`}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
                      >
                        Connect
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

            {billing.tier.invoiceLimit !== null && (
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
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
              </div>
            )}

            {billing.tier.invoiceLimit === null && (
              <p className="text-sm text-muted">Unlimited invoices this month.</p>
            )}

            <div className="mt-6 flex gap-3">
              <Link
                href="/settings/billing"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
              >
                Manage Billing
              </Link>
              {billing.subscriptionStatus === "active" && (
                <button
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
                  className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
                >
                  Manage Subscription
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "ai" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              AI-Generated Reminders
            </h2>
            <p className="mb-6 text-sm text-muted">
              Use AI to generate personalized, context-aware reminder emails for each invoice.
              Requires a paid plan.
            </p>

            {aiSettings.limit === 0 ? (
              <div className="rounded-lg bg-[var(--warning-muted)] p-4">
                <p className="text-sm text-[var(--warning)]">
                  AI reminders are not available on the Free plan. Upgrade to Pro or Agency to unlock this feature.
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
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-muted">
                      Enable AI Reminders
                    </label>
                    <button
                      onClick={() => setAiEnabled(!aiEnabled)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        aiEnabled ? "bg-purple-600" : "bg-surface-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                          aiEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    When enabled, the cron job will generate AI reminders for due invoices. You must approve them before they are sent.
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted">
                    Default Tone
                  </label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="mt-1 block w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="firm">Firm</option>
                    <option value="casual">Casual</option>
                  </select>
                  <p className="mt-1 text-xs text-muted">
                    This tone will be used by default when generating AI reminders. You can override it per-invoice.
                  </p>
                </div>

                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted">
                      Monthly AI usage: {aiSettings.usage} / {aiSettings.limit}
                    </span>
                    <span className="font-medium text-foreground">
                      {Math.round((aiSettings.usage / aiSettings.limit) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
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

                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <button
                    onClick={handleSaveAISettings}
                    disabled={savingAI}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  >
                    {savingAI ? "Saving..." : "Save AI Settings"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "portal" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              White-Labeled Client Portal
            </h2>
            <p className="mb-6 text-sm text-muted">
              Give your clients a branded portal to view their invoices and make payments.
              Each client gets a secure, shareable link.
            </p>

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
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-muted">
                      Enable Client Portal
                    </label>
                    <button
                      onClick={() => setPortalEnabled(!portalEnabled)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        portalEnabled ? "bg-accent" : "bg-surface-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                          portalEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    When enabled, you can generate secure portal links for your clients from the Invoices page.
                  </p>
                </div>

                <div className="mb-6 space-y-4">
                  <h3 className="text-sm font-medium text-muted">Branding</h3>

                  <div>
                    <label className="block text-xs text-muted">Business Name</label>
                    <input
                      type="text"
                      value={branding.businessName}
                      onChange={(e) => setBranding((prev) => ({ ...prev, businessName: e.target.value }))}
                      placeholder="Your business name"
                      className="mt-1 block w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted">Logo URL</label>
                    <input
                      type="text"
                      value={branding.logoUrl}
                      onChange={(e) => setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                      className="mt-1 block w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted">Accent Color</label>
                    <div className="mt-1 flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.accentColor}
                        onChange={(e) => setBranding((prev) => ({ ...prev, accentColor: e.target.value }))}
                        className="h-9 w-12 cursor-pointer rounded border border-border"
                      />
                      <input
                        type="text"
                        value={branding.accentColor}
                        onChange={(e) => {
                          if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                            setBranding((prev) => ({ ...prev, accentColor: e.target.value }));
                          }
                        }}
                        placeholder="#2563eb"
                        className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-muted">Tagline</label>
                    <input
                      type="text"
                      value={branding.tagline}
                      onChange={(e) => setBranding((prev) => ({ ...prev, tagline: e.target.value }))}
                      placeholder="e.g. Professional invoicing made simple"
                      className="mt-1 block w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted">Favicon URL</label>
                    <input
                      type="text"
                      value={branding.faviconUrl}
                      onChange={(e) => setBranding((prev) => ({ ...prev, faviconUrl: e.target.value }))}
                      placeholder="https://example.com/favicon.ico"
                      className="mt-1 block w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-medium text-muted">Preview</h3>
                  <div
                    className="rounded-lg border border-border p-4"
                    style={{ borderTopColor: branding.accentColor, borderTopWidth: "3px" }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {branding.logoUrl ? (
                        <img
                          src={branding.logoUrl}
                          alt="Logo"
                          className="h-8 w-8 rounded object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white"
                          style={{ backgroundColor: branding.accentColor }}
                        >
                          {branding.businessName.charAt(0).toUpperCase() || "B"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">{branding.businessName || "Your Business"}</p>
                        {branding.tagline && <p className="text-xs text-muted">{branding.tagline}</p>}
                      </div>
                    </div>
                    <div className="rounded bg-surface-muted p-3 text-xs text-muted">
                      Client invoices will appear here with your branding applied.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-border pt-4">
                  <button
                    onClick={handleSavePortalSettings}
                    disabled={savingPortal}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  >
                    {savingPortal ? "Saving..." : "Save Portal Settings"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "promises" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              AI Promise Detection
            </h2>
            <p className="mb-6 text-sm text-muted">
              Automatically detect when clients promise to pay via email replies. Reminders pause until the promised date passes.
            </p>

            {!promiseSettings.hasAccess ? (
              <div className="rounded-lg bg-[var(--warning-muted)] p-4">
                <p className="text-sm text-[var(--warning)]">
                  Promise detection is not available on the Free plan. Upgrade to Pro or Agency to unlock this feature.
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
                <div className="mb-6 grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-surface-muted p-4 text-center">
                    <p className="text-2xl font-bold text-[var(--success)]">{promiseSettings.active}</p>
                    <p className="text-xs text-muted">Active Promises</p>
                  </div>
                  <div className="rounded-lg bg-surface-muted p-4 text-center">
                    <p className="text-2xl font-bold text-[var(--warning)]">{promiseSettings.pending}</p>
                    <p className="text-xs text-muted">Pending Review</p>
                  </div>
                  <div className="rounded-lg bg-surface-muted p-4 text-center">
                    <p className="text-2xl font-bold text-muted">{promiseSettings.expired}</p>
                    <p className="text-xs text-muted">Expired</p>
                  </div>
                </div>

                <div className="rounded-lg bg-surface-muted p-4 mb-6">
                  <h3 className="text-sm font-medium text-foreground mb-2">How it works</h3>
                  <ol className="list-decimal list-inside text-sm text-muted space-y-1">
                    <li>Set up Mailgun to forward email replies to your Invoice Nudger webhook</li>
                    <li>AI analyzes replies for payment promises and extracts dates</li>
                    <li>High confidence (&gt;80%) promises auto-pause reminders</li>
                    <li>Medium confidence (50-80%) promises go to your review queue</li>
                    <li>After a promised date passes, a firmer reminder is sent</li>
                  </ol>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/promises"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
                  >
                    Review Promises
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              SMS & WhatsApp Reminders
            </h2>
            <p className="mb-6 text-sm text-muted">
              Send reminder messages via SMS or WhatsApp when email fails or as a primary channel. Requires a paid plan and a Twilio account.
            </p>

            {!notificationSettings.sms.enabled && !notificationSettings.whatsapp.enabled ? (
              <div className="rounded-lg bg-[var(--warning-muted)] p-4">
                <p className="text-sm text-[var(--warning)]">
                  SMS and WhatsApp reminders are not available on the Free plan. Upgrade to Pro or Agency to unlock this feature.
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
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-surface-muted p-4">
                    <h3 className="text-sm font-medium text-foreground mb-2">SMS</h3>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted">
                        Monthly usage: {notificationSettings.sms.used} / {notificationSettings.sms.limit}
                      </span>
                      <span className="font-medium text-foreground">
                        {notificationSettings.sms.limit > 0 ? Math.round((notificationSettings.sms.used / notificationSettings.sms.limit) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          notificationSettings.sms.used >= notificationSettings.sms.limit
                            ? "bg-[var(--danger)]"
                            : notificationSettings.sms.limit > 0 && (notificationSettings.sms.used / notificationSettings.sms.limit) * 100 > 80
                            ? "bg-[var(--warning)]"
                            : "bg-accent"
                        }`}
                        style={{ width: `${notificationSettings.sms.limit > 0 ? Math.min((notificationSettings.sms.used / notificationSettings.sms.limit) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-muted p-4">
                    <h3 className="text-sm font-medium text-foreground mb-2">WhatsApp</h3>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted">
                        Monthly usage: {notificationSettings.whatsapp.used} / {notificationSettings.whatsapp.limit}
                      </span>
                      <span className="font-medium text-foreground">
                        {notificationSettings.whatsapp.limit > 0 ? Math.round((notificationSettings.whatsapp.used / notificationSettings.whatsapp.limit) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          notificationSettings.whatsapp.used >= notificationSettings.whatsapp.limit
                            ? "bg-[var(--danger)]"
                            : notificationSettings.whatsapp.limit > 0 && (notificationSettings.whatsapp.used / notificationSettings.whatsapp.limit) * 100 > 80
                            ? "bg-[var(--warning)]"
                            : "bg-accent"
                        }`}
                        style={{ width: `${notificationSettings.whatsapp.limit > 0 ? Math.min((notificationSettings.whatsapp.used / notificationSettings.whatsapp.limit) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-surface-muted p-4 mb-6">
                  <h3 className="text-sm font-medium text-foreground mb-2">Configuration</h3>
                  <p className="text-sm text-muted mb-3">
                    Set the following environment variables on your server to enable SMS and WhatsApp:
                  </p>
                  <pre className="text-xs text-muted bg-surface rounded-lg p-3 overflow-x-auto">
{`TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+12025551234
TWILIO_WHATSAPP_NUMBER=+14155238886`}
                  </pre>
                </div>

                <div className="rounded-lg bg-surface-muted p-4 mb-6">
                  <h3 className="text-sm font-medium text-foreground mb-2">How it works</h3>
                  <ol className="list-decimal list-inside text-sm text-muted space-y-1">
                    <li>Add a phone number (E.164 format, e.g. +12025551234) to your invoices</li>
                    <li>When email reminders fail, the cron job falls back to WhatsApp first, then SMS</li>
                    <li>You can also manually send SMS or WhatsApp reminders from the Invoices page</li>
                    <li>All messages include opt-out language (&quot;Reply STOP to unsubscribe&quot;)</li>
                    <li>Opt-outs are automatically recorded and respected</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "late-fees" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              Late Fees & Interest
            </h2>
            <p className="mb-6 text-sm text-muted">
              Automatically apply late fees and daily interest to overdue invoices. Late fees are applied once per invoice after the grace period. Daily interest accrues each day the invoice remains unpaid.
            </p>

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
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-muted">
                      Enable Late Fees & Interest
                    </label>
                    <button
                      onClick={() => setLateFeeEnabled(!lateFeeEnabled)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        lateFeeEnabled ? "bg-accent" : "bg-surface-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                          lateFeeEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    When enabled, the daily cron job will calculate and accrue late fees and interest on unpaid invoices.
                  </p>
                </div>

                {lateFeeEnabled && (
                  <>
                    <div className="mb-6 rounded-lg border border-border bg-surface-muted p-4">
                      <h3 className="mb-3 text-sm font-medium text-foreground">Late Fee</h3>

                      <div className="mb-4">
                        <label className="block text-xs text-muted mb-1">Type</label>
                        <select
                          value={lateFeeType}
                          onChange={(e) => setLateFeeType(e.target.value)}
                          className="block w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        >
                          <option value="fixed">Fixed amount</option>
                          <option value="percentage">Percentage of invoice</option>
                        </select>
                      </div>

                      <div className="mb-4">
                        <label className="block text-xs text-muted mb-1">
                          {lateFeeType === "fixed" ? "Late Fee Amount" : "Late Fee Percentage"}
                        </label>
                        <div className="relative max-w-xs">
                          <input
                            type="number"
                            value={lateFeeValue || ""}
                            onChange={(e) => setLateFeeValue(parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                          />
                          <span className="absolute right-3 top-2 text-sm text-muted">
                            {lateFeeType === "fixed" ? "$" : "%"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">Frequency</label>
                        <select
                          value={lateFeeFrequency}
                          onChange={(e) => setLateFeeFrequency(e.target.value)}
                          className="block w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        >
                          <option value="once">One-time (applied once after due date)</option>
                          <option value="recurring">Recurring (applied each billing period)</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-6 rounded-lg border border-border bg-surface-muted p-4">
                      <h3 className="mb-3 text-sm font-medium text-foreground">Daily Interest</h3>

                      <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-xs text-muted">Enable Daily Interest</label>
                          <button
                            onClick={() => setInterestEnabled(!interestEnabled)}
                            className={`relative h-6 w-11 rounded-full transition ${
                              interestEnabled ? "bg-accent" : "bg-surface-muted"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                                interestEnabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-xs text-muted">
                          When enabled, interest accrues daily on the original invoice amount at the rate below.
                        </p>
                      </div>

                      {interestEnabled && (
                        <div>
                          <label className="block text-xs text-muted mb-1">Daily Interest Rate (%)</label>
                          <div className="relative max-w-xs">
                            <input
                              type="number"
                              value={interestRate || ""}
                              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                              step="0.01"
                              min="0"
                              placeholder="e.g. 0.05"
                              className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            />
                            <span className="absolute right-3 top-2 text-sm text-muted">%</span>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            For example, 0.05% per day = ~18.25% APR on the original invoice amount.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mb-6 rounded-lg border border-border bg-surface-muted p-4">
                      <h3 className="mb-3 text-sm font-medium text-foreground">General Settings</h3>

                      <div className="mb-4">
                        <label className="block text-xs text-muted mb-1">Grace Period (days)</label>
                        <input
                          type="number"
                          value={graceDays || ""}
                          onChange={(e) => setGraceDays(parseInt(e.target.value) || 0)}
                          min="0"
                          className="block w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                        <p className="mt-1 text-xs text-muted">
                          Days after the due date before late fees and interest begin applying.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs text-muted mb-1">Maximum Fee Cap ($)</label>
                        <input
                          type="number"
                          value={feeCap || ""}
                          onChange={(e) => setFeeCap(parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          className="block w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        />
                        <p className="mt-1 text-xs text-muted">
                          Maximum total fees (late fee + interest) that can accrue. Set to 0 for no limit.
                        </p>
                      </div>
                    </div>

                    <div className="mb-6 rounded-lg border border-[var(--warning-muted)] bg-[var(--warning-muted)]/50 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-[var(--warning)] text-lg flex-shrink-0">&#9888;&#65039;</span>
                        <div>
                          <h3 className="text-sm font-medium text-foreground mb-1">Legal Disclaimer</h3>
                          <p className="text-xs text-muted">
                            This information is provided for informational purposes only and does not constitute legal advice. Late fees, interest rates, and collections practices are subject to applicable laws and regulations, including but not limited to usury laws and fair debt collection practices. Please consult with a legal professional to ensure compliance with your jurisdiction&apos;s requirements.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-border pt-4">
                      <button
                        onClick={handleSaveLateFees}
                        disabled={savingLateFees}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
                      >
                        {savingLateFees ? "Saving..." : "Save Late Fee Settings"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

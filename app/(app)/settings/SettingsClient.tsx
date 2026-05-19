"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

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

interface SettingsClientProps {
  schedule: Schedule | null;
  integrations: Integration[];
}

type Tab = "reminders" | "integrations";

function offsetLabel(daysOffset: number): string {
  if (daysOffset < 0) return `${Math.abs(daysOffset)} days before due`;
  if (daysOffset === 0) return "On due date";
  return `${daysOffset} days after due`;
}

const platformConfig: Record<string, { label: string; color: string; icon: string }> = {
  xero: { label: "Xero", color: "#13B5EA", icon: "X" },
  quickbooks: { label: "QuickBooks", color: "#2CA01C", icon: "QB" },
};

export default function SettingsClient({ schedule, integrations: initialIntegrations }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("reminders");
  const [steps, setSteps] = useState<Step[]>(schedule?.steps ?? []);
  const [name, setName] = useState(schedule?.name ?? "Standard");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);

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
    </div>
  );
}

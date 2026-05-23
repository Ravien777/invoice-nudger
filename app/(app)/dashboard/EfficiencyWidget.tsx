"use client";

import type { CollectionEfficiencyMetrics } from "@/lib/analytics";

const TEMPLATE_LABELS: Record<string, string> = {
  gentle_reminder: "Gentle Reminder",
  due_today: "Due Today",
  overdue_notice: "Overdue Notice",
  firm_reminder: "Firm Reminder",
  final_notice: "Final Notice",
  broken_promise_notice: "Broken Promise",
  manual_payment: "Manual Payment",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

function channelColor(channel: string): string {
  switch (channel) {
    case "email": return "var(--accent)";
    case "sms": return "var(--success)";
    case "whatsapp": return "var(--warning)";
    default: return "var(--muted)";
  }
}

function fmtPct(val: number | null): string {
  if (val === null) return "—";
  return (val * 100).toFixed(0) + "%";
}

function fmtDays(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(1) + "d";
}

interface EfficiencyWidgetProps {
  metrics: CollectionEfficiencyMetrics | null;
  plan: string;
}

export default function EfficiencyWidget({ metrics, plan }: EfficiencyWidgetProps) {
  const isProOrAgency = plan === "pro" || plan === "agency";
  const hasData = metrics && metrics.overall.totalPaidWithReminders > 0;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted">Collection Efficiency</h2>
        <p className="mt-2 text-sm text-muted">
          Send your first reminders to see collection efficiency insights.
        </p>
      </div>
    );
  }

  const { overall, byTemplate, byChannel } = metrics!;

  function handleDownloadReport() {
    window.open("/api/analytics/efficiency/report", "_blank");
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Collection Efficiency</h2>
        {isProOrAgency && (
          <button
            onClick={handleDownloadReport}
            className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
          >
            Download Efficiency Report
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-muted p-4">
          <p className="text-xs font-medium text-muted">Paid After Reminder</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{overall.totalPaidWithReminders}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-muted p-4">
          <p className="text-xs font-medium text-muted">Avg Days from Reminder to Payment</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{fmtDays(overall.avgDaysReminderToPayment)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-muted p-4">
          <p className="text-xs font-medium text-muted">Paid Within 3 Days</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {overall.paidWithin3Days}
            <span className="ml-1.5 text-sm font-normal text-muted">
              ({fmtPct(overall.within3DaysRate)})
            </span>
          </p>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        Your reminders help you get paid faster. On average, invoices are paid{" "}
        <strong className="text-foreground">{fmtDays(overall.avgDaysReminderToPayment)}</strong>{" "}
        after the last reminder.
      </p>

      {byTemplate.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold text-muted">Per Template</h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-3 py-2 font-medium text-muted">Template</th>
                  <th className="px-3 py-2 font-medium text-muted">Sent</th>
                  <th className="px-3 py-2 font-medium text-muted">Paid Within 3d</th>
                  <th className="px-3 py-2 font-medium text-muted">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byTemplate.map((t) => (
                  <tr key={t.template} className="transition hover:bg-surface-muted">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {TEMPLATE_LABELS[t.template] || t.template}
                    </td>
                    <td className="px-3 py-2 text-muted">{t.timesSent}</td>
                    <td className="px-3 py-2 text-muted">{t.paymentsWithin3Days}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${(t.conversionRate ?? 0) * 100}%` }}
                          />
                        </div>
                        <span className="font-medium text-foreground">
                          {fmtPct(t.conversionRate)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {byChannel.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted">Per Channel</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {byChannel.map((c) => (
              <div
                key={c.channel}
                className="rounded-lg border border-border bg-surface-muted p-3"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: channelColor(c.channel) }}
                  />
                  <span className="text-xs font-medium text-foreground">
                    {CHANNEL_LABELS[c.channel] || c.channel}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Sent <strong className="text-foreground">{c.timesSent}</strong> times,{" "}
                  {c.paymentsWithin3Days} paid within 3d
                </p>
                <p className="text-xs text-muted">
                  Conversion: <strong className="text-foreground">{fmtPct(c.conversionRate)}</strong>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isProOrAgency && (
        <p className="mt-4 text-[11px] text-muted">
          Upgrade to{" "}
          <a href="/settings/billing" className="text-accent hover:underline">Pro or Agency</a>{" "}
          to download an Efficiency Report PDF.
        </p>
      )}
    </div>
  );
}

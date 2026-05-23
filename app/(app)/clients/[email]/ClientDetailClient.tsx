"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ClientProfile {
  id: string;
  clientEmail: string;
  totalInvoices: number;
  paidInvoices: number;
  onTimePayments: number;
  totalAmount: number;
  avgDaysLate: number | null;
  lastPaymentDate: string | null;
  riskScore: number | null;
}

interface InvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
}

interface ClientDetailClientProps {
  profile: ClientProfile;
  invoices: InvoiceSummary[];
}

const ITEMS_PER_PAGE = 10;

function riskLevel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: "Unknown", color: "bg-surface-muted text-muted" };
  if (score <= 0.3) return { label: "Low", color: "bg-[var(--success-muted)] text-[var(--success)]" };
  if (score <= 0.7) return { label: "Medium", color: "bg-[var(--warning-muted)] text-[var(--warning)]" };
  return { label: "High", color: "bg-[var(--danger-muted)] text-[var(--danger)]" };
}

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status: string): string {
  switch (status) {
    case "paid": return "bg-[var(--success-muted)] text-[var(--success)]";
    case "cancelled": return "bg-surface-muted text-muted";
    case "overdue": return "bg-[var(--danger-muted)] text-[var(--danger)]";
    default: return "bg-[var(--warning-muted)] text-[var(--warning)]";
  }
}

function daysBetween(a: string, b: string | null): number | null {
  if (!b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default function ClientDetailClient({
  profile,
  invoices,
}: ClientDetailClientProps) {
  const [page, setPage] = useState(0);
  const [showRiskInfo, setShowRiskInfo] = useState(false);

  const risk = riskLevel(profile.riskScore);
  const totalPages = Math.ceil(invoices.length / ITEMS_PER_PAGE);
  const pageInvoices = invoices.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const onTimeRatio = profile.paidInvoices > 0
    ? ((profile.onTimePayments / profile.paidInvoices) * 100).toFixed(0)
    : "N/A";

  const insightParts: string[] = [];
  if (profile.avgDaysLate !== null && profile.avgDaysLate > 0) {
    insightParts.push(
      `This client typically pays ${profile.avgDaysLate.toFixed(0)} days late.`
    );
    const recommendDays = Math.max(1, Math.round(profile.avgDaysLate) - 5);
    insightParts.push(
      `Consider sending reminders ${recommendDays} days before due.`
    );
  } else if (profile.avgDaysLate !== null) {
    insightParts.push("This client usually pays on time or early.");
  } else {
    insightParts.push("Not enough payment history to generate insights yet.");
  }
  const insight = insightParts.join(" ");

  const chartData = invoices
    .filter((inv) => inv.paidAt)
    .map((inv) => {
      const daysLate = daysBetween(inv.dueDate, inv.paidAt) ?? 0;
      return {
        date: formatDate(inv.dueDate),
        daysLate: Math.max(daysLate, 0),
        paidOnTime: daysLate <= 0 ? 1 : 0,
      };
    })
    .reverse();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{profile.clientEmail}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${risk.color}`}>
                {risk.label} Risk
              </span>
              <span className="text-sm text-muted">
                {profile.totalInvoices} invoice{profile.totalInvoices !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-muted">On-Time Rate</p>
            <p className="mt-1 text-xl font-bold text-foreground">{onTimeRatio}%</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Avg Days Late</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {profile.avgDaysLate !== null ? `${profile.avgDaysLate.toFixed(1)}d` : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Total Paid</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {formatCurrency(profile.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Last Payment</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {formatDate(profile.lastPaymentDate)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowRiskInfo(!showRiskInfo)}
            className="text-xs text-accent hover:underline"
          >
            {showRiskInfo ? "Hide" : "Show"} risk score explanation
          </button>
          {showRiskInfo && (
            <div className="mt-2 rounded-lg bg-surface-muted p-3 text-xs text-muted">
              <p className="mb-1 font-medium text-foreground">Risk Score: {profile.riskScore?.toFixed(2) ?? "N/A"}</p>
              <p className="mb-1">
                Formula: <code>(1 - onTimeRatio) &times; 0.7 + (avgDaysLate / 30) &times; 0.3</code>
              </p>
              <p>
                onTimeRatio = {profile.onTimePayments} / {profile.paidInvoices} ={" "}
                {profile.paidInvoices > 0 ? (profile.onTimePayments / profile.paidInvoices).toFixed(2) : "0"}
                , avgDaysLate = {profile.avgDaysLate?.toFixed(1) ?? "0"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Insight</h2>
        <p className="text-sm text-muted">{insight}</p>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Payment History</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickMargin={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickMargin={4}
                  label={{
                    value: "Days Late",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "var(--muted)" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="daysLate"
                  name="Days Late"
                  fill="var(--warning)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Invoices
          {invoices.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              ({invoices.length} total)
            </span>
          )}
        </h2>

        {invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices for this client.</p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="pb-2 font-medium text-muted">Invoice #</th>
                  <th className="pb-2 font-medium text-muted">Amount</th>
                  <th className="pb-2 font-medium text-muted">Due Date</th>
                  <th className="pb-2 font-medium text-muted">Paid Date</th>
                  <th className="pb-2 font-medium text-muted">Days Late</th>
                  <th className="pb-2 font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageInvoices.map((inv) => {
                  const daysLate = daysBetween(inv.dueDate, inv.paidAt);
                  return (
                    <tr key={inv.id} className="transition hover:bg-surface-muted">
                      <td className="py-2 text-muted">
                        <Link
                          href={`/invoices/${inv.id}/edit`}
                          className="text-accent hover:underline"
                        >
                          {inv.invoiceNumber || "-"}
                        </Link>
                      </td>
                      <td className="py-2 font-medium text-foreground">
                        {formatCurrency(inv.amount, inv.currency)}
                      </td>
                      <td className="py-2 text-muted">{formatDate(inv.dueDate)}</td>
                      <td className="py-2 text-muted">{formatDate(inv.paidAt)}</td>
                      <td className="py-2 text-muted">
                        {daysLate !== null ? (
                          <span className={daysLate > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"}>
                            {daysLate > 0 ? `${daysLate}d late` : "On time"}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

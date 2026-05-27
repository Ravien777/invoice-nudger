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
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import type { BadgeVariant } from "@/app/components/ui/Badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/app/components/ui/Table";
import { formatCurrency } from "@/lib/format-currency";

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

function riskLevel(
  score: number | null,
): { label: string; badge: string } {
  if (score === null)
    return {
      label: "Unknown",
      badge: "bg-surface-tertiary text-text-tertiary",
    };
  if (score <= 0.3)
    return { label: "Low", badge: "bg-success/10 text-success" };
  if (score <= 0.7)
    return { label: "Medium", badge: "bg-warning/10 text-warning" };
  return { label: "High", badge: "bg-danger/10 text-danger" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  const pageInvoices = invoices.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE,
  );

  const onTimeRatio =
    profile.paidInvoices > 0
      ? ((profile.onTimePayments / profile.paidInvoices) * 100).toFixed(0)
      : "N/A";

  const insightParts: string[] = [];
  if (profile.avgDaysLate !== null && profile.avgDaysLate > 0) {
    insightParts.push(
      `This client typically pays ${profile.avgDaysLate.toFixed(0)} days late.`,
    );
    const recommendDays = Math.max(1, Math.round(profile.avgDaysLate) - 5);
    insightParts.push(
      `Consider sending reminders ${recommendDays} days before due.`,
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

  function statusVariant(s: string): BadgeVariant {
    switch (s) {
      case "paid":
        return "paid";
      case "cancelled":
        return "cancelled";
      case "overdue":
        return "overdue";
      case "draft":
        return "draft";
      case "sent":
        return "sent";
      default:
        return "neutral";
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {profile.clientEmail}
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${risk.badge}`}
              >
                {risk.label} Risk
              </span>
              <span className="text-sm text-text-secondary">
                {profile.totalInvoices} invoice
                {profile.totalInvoices !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-text-secondary">
              On-Time Rate
            </p>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {onTimeRatio}%
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Avg Days Late
            </p>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {profile.avgDaysLate !== null
                ? `${profile.avgDaysLate.toFixed(1)}d`
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Total Paid
            </p>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {formatCurrency(profile.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Last Payment
            </p>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {formatDate(profile.lastPaymentDate)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRiskInfo(!showRiskInfo)}
          >
            {showRiskInfo ? "Hide" : "Show"} risk score explanation
          </Button>
          {showRiskInfo && (
            <div className="mt-2 rounded-lg bg-surface-tertiary p-3 text-xs text-text-secondary">
              <p className="mb-1 font-medium text-text-primary">
                Risk Score: {profile.riskScore?.toFixed(2) ?? "N/A"}
              </p>
              <p className="mb-1">
                Formula: <code>(1 - onTimeRatio) &times; 0.7 + (avgDaysLate / 30) &times; 0.3</code>
              </p>
              <p>
                onTimeRatio = {profile.onTimePayments} /{" "}
                {profile.paidInvoices} ={" "}
                {profile.paidInvoices > 0
                  ? (profile.onTimePayments / profile.paidInvoices).toFixed(2)
                  : "0"}
                , avgDaysLate = {profile.avgDaysLate?.toFixed(1) ?? "0"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Insight */}
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          Insight
        </h2>
        <p className="text-sm text-text-secondary">{insight}</p>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Payment History
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
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

      {/* Invoices table */}
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Invoices
          {invoices.length > 0 && (
            <span className="ml-2 text-sm font-normal text-text-secondary">
              ({invoices.length} total)
            </span>
          )}
        </h2>

        {invoices.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No invoices for this client.
          </p>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Paid Date</TableCell>
                  <TableCell>Days Late</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageInvoices.map((inv) => {
                  const daysLate = daysBetween(inv.dueDate, inv.paidAt);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-text-secondary">
                        <Link
                          href={`/invoices/${inv.id}/edit`}
                          className="text-accent hover:underline"
                        >
                          {inv.invoiceNumber || "-"}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium text-text-primary">
                        {formatCurrency(inv.amount, inv.currency)}
                      </TableCell>
                      <TableCell>{formatDate(inv.dueDate)}</TableCell>
                      <TableCell>{formatDate(inv.paidAt)}</TableCell>
                      <TableCell>
                        {daysLate !== null ? (
                          <span
                            className={
                              daysLate > 0 ? "text-danger" : "text-success"
                            }
                          >
                            {daysLate > 0 ? `${daysLate}d late` : "On time"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(inv.status)}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-text-tertiary">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

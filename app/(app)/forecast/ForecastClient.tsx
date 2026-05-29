"use client";

import { useEffect, useState } from "react";
import {
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { CashflowResult } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/format-currency";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConfidenceBadge({
  confidence,
  reason,
}: {
  confidence: CashflowResult["confidence"];
  reason: string;
}) {
  const colorMap = {
    high: "bg-green-500/10 text-green-600 border-green-500/20",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    low: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <div className="relative group">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colorMap[confidence]}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            confidence === "high"
              ? "bg-green-600"
              : confidence === "medium"
                ? "bg-amber-600"
                : "bg-red-600"
          }`}
        />
        Forecast confidence: {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
        <div className="bg-surface-secondary border border-border-default rounded-lg px-3 py-2 text-xs text-text-secondary shadow-lg whitespace-nowrap">
          {reason}
        </div>
      </div>
    </div>
  );
}

function SixtyDayCallout({
  balance,
  date,
}: {
  balance: number;
  date: string;
}) {
  const isPositive = balance >= 0;
  return (
    <div
      className={`rounded-lg border p-4 ${
        isPositive
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}
    >
      <p className="text-sm text-text-secondary">
        Based on current data, your balance on{" "}
        <span className="font-medium text-text-primary">{formatDate(date)}</span>{" "}
        should be approximately{" "}
        <span
          className={`font-semibold ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(balance)}
        </span>
        .
      </p>
    </div>
  );
}

export default function ForecastClient() {
  const [data, setData] = useState<CashflowResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/reports/cashflow");
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to load forecast");
        }
        const json: CashflowResult = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!data || data.weeks.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6">
        <p className="text-sm text-text-secondary">
          No data available to generate a forecast.
        </p>
      </div>
    );
  }

  const chartData = data.weeks.map((w) => ({
    label: formatDate(w.weekStart),
    income: w.expectedIncome,
    expenses: w.expectedExpenses,
    netCashFlow: w.netCashFlow,
    cumulative: w.cumulativeBalance,
  }));

  const xInterval = Math.max(1, Math.floor(chartData.length / 6));

  return (
    <div className="space-y-6">
      {/* Confidence badge + summary row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ConfidenceBadge confidence={data.confidence} reason={data.confidenceReason} />
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="text-right">
            <p className="text-text-secondary">Expected Income</p>
            <p className="font-semibold text-green-600">
              {formatCurrency(data.totalExpectedIncome)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-secondary">Expected Expenses</p>
            <p className="font-semibold text-red-600">
              {formatCurrency(data.totalExpectedExpenses)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-secondary">Net Cash Flow</p>
            <p
              className={`font-semibold ${
                data.totalNetCashFlow >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(data.totalNetCashFlow)}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">
          Next 90 Days
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickMargin={4}
                interval={xInterval}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickFormatter={(val: number) => formatCurrency(val)}
                tickMargin={4}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  return (
                    <div className="rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-xs shadow-lg">
                      <p className="mb-1 font-medium text-text-primary">{d.label}</p>
                      <p className="text-green-600">Income: {formatCurrency(d.income)}</p>
                      <p className="text-red-600">Expenses: {formatCurrency(d.expenses)}</p>
                      <p className="text-text-primary">Net: {formatCurrency(d.netCashFlow)}</p>
                      <p className="text-blue-600 font-medium">
                        Cumulative: {formatCurrency(d.cumulative)}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: "var(--muted)" }}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="Expected Income"
                stroke="#22c55e"
                strokeWidth={1.5}
                fill="url(#incomeFill)"
                dot={false}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Expected Expenses"
                stroke="#ef4444"
                strokeWidth={1.5}
                fill="url(#expenseFill)"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Net Cash Flow"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 60-day callout */}
      <SixtyDayCallout balance={data.sixtyDayBalance} date={data.sixtyDayDate} />

      {/* Weekly breakdown table */}
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">
          Weekly Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-2 px-2 font-medium text-text-secondary">Week</th>
                <th className="text-right py-2 px-2 font-medium text-text-secondary">Income</th>
                <th className="text-right py-2 px-2 font-medium text-text-secondary">Expenses</th>
                <th className="text-right py-2 px-2 font-medium text-text-secondary">Net</th>
                <th className="text-right py-2 px-2 font-medium text-text-secondary">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((w) => (
                <tr key={w.weekStart} className="border-b border-border-default hover:bg-surface-tertiary/50 transition-colors">
                  <td className="py-2 px-2 text-text-primary">{formatDate(w.weekStart)}</td>
                  <td className="py-2 px-2 text-right text-green-600 tabular-nums">
                    {formatCurrency(w.expectedIncome)}
                  </td>
                  <td className="py-2 px-2 text-right text-red-600 tabular-nums">
                    {formatCurrency(w.expectedExpenses)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ color: w.netCashFlow >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {formatCurrency(w.netCashFlow)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-medium" style={{ color: w.cumulativeBalance >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {formatCurrency(w.cumulativeBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This forecast is a best-guess estimate based on your open invoices,
          recurring billing, and historical expense patterns. Actual results may
          vary. Review your financials regularly and consult a professional
          advisor for important decisions.
        </p>
      </div>
    </div>
  );
}

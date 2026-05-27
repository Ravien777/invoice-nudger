"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ForecastResult } from "@/lib/forecast";
import { Button } from "@/app/components/ui/Button";
import { formatCurrency } from "@/lib/format-currency";

interface ForecastWidgetProps {
  forecast: ForecastResult | null;
  hasAccess: boolean;
}

const HORIZONS = [30, 60, 90] as const;

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ForecastWidget({ forecast, hasAccess }: ForecastWidgetProps) {
  const [horizon, setHorizon] = useState<number>(30);

  const chartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.days
      .filter((d) => d.dayOffset < horizon)
      .map((d) => ({
        date: formatShortDate(d.date),
        expected: Math.round(d.expectedInflow * 100) / 100,
        worst: Math.round(d.worstInflow * 100) / 100,
        best: Math.round(d.bestInflow * 100) / 100,
        invoices: d.expectedInvoices,
      }));
  }, [forecast, horizon]);

  if (!hasAccess) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <h2 className="text-sm font-medium text-text-secondary">Cash Flow Forecast</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Upgrade to{" "}
          <a href="/settings/billing" className="text-accent hover:underline">Pro or Agency</a>{" "}
          to see your projected cash flow.
        </p>
      </div>
    );
  }

  if (!forecast || forecast.days.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <h2 className="text-sm font-medium text-text-secondary">Cash Flow Forecast</h2>
        <p className="mt-2 text-sm text-text-secondary">No open invoices to forecast.</p>
      </div>
    );
  }

  const totals = forecast.totals;
  const visibleTotals = chartData.reduce(
    (acc, d) => ({
      expected: acc.expected + d.expected,
      worst: acc.worst + d.worst,
      best: acc.best + d.best,
    }),
    { expected: 0, worst: 0, best: 0 }
  );

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary">Cash Flow Forecast</h2>
        <div className="flex gap-1 rounded-lg bg-surface-tertiary p-0.5">
          {HORIZONS.map((h) => (
            <Button
              key={h}
              variant="ghost"
              size="sm"
              onClick={() => setHorizon(h)}
              className={horizon === h ? "bg-accent text-white" : ""}
            >
              {h}d
            </Button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="bestFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--success)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="expectedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="worstFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--danger)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickMargin={4}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickFormatter={(val: number) => formatCurrency(val)}
              tickMargin={4}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0]?.payload;
                if (!data) return null;
                return (
                  <div className="rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-medium text-text-primary">{data.date}</p>
                    <p className="text-success">Best: {formatCurrency(data.best)}</p>
                    <p className="text-accent">Expected: {formatCurrency(data.expected)}</p>
                    <p className="text-danger">Worst: {formatCurrency(data.worst)}</p>
                    {data.invoices?.length > 0 && (
                      <>
                        <p className="mt-1.5 text-[10px] font-medium text-text-secondary">Top invoices:</p>
                        {data.invoices.map((inv: { clientName: string; amount: number; probability: number }, i: number) => (
                          <p key={i} className="text-text-secondary">
                            {inv.clientName} — {formatCurrency(inv.amount)} ({(inv.probability * 100).toFixed(0)}%)
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "var(--muted)" }}
            />
            <Area
              type="monotone"
              dataKey="best"
              name="Best Case"
              stroke="var(--success)"
              strokeWidth={1.5}
              fill="url(#bestFill)"
              dot={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#expectedFill)"
              dot={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="worst"
              name="Worst Case"
              stroke="var(--danger)"
              strokeWidth={1.5}
              fill="url(#worstFill)"
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-text-secondary">Expected</p>
          <p className="font-semibold text-text-primary">{formatCurrency(visibleTotals.expected)}</p>
        </div>
        <div>
          <p className="text-text-secondary">Best Case</p>
          <p className="font-semibold text-success">{formatCurrency(visibleTotals.best)}</p>
        </div>
        <div>
          <p className="text-text-secondary">Worst Case</p>
          <p className="font-semibold text-danger">{formatCurrency(visibleTotals.worst)}</p>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-text-tertiary">
        Based on historical client payment patterns and current open invoices. Actual results may vary.
      </p>
    </div>
  );
}

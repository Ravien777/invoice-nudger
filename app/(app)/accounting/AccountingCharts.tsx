"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/format-currency";
import type { ForecastResult } from "@/lib/forecast";

function formatChartMonth(month: string): string {
  const [, m] = month.split("-");
  return new Date(2024, parseInt(m, 10) - 1).toLocaleDateString("en-US", {
    month: "short",
  });
}

interface AccountingChartsProps {
  chartData: { month: string; income: number; expenses: number }[];
  forecast: ForecastResult | null;
  hasForecastAccess: boolean;
  baseCurrency: string;
}

export default function AccountingCharts({
  chartData,
  forecast,
  hasForecastAccess,
  baseCurrency,
}: AccountingChartsProps) {
  const barChartData = useMemo(
    () =>
      chartData.map((d) => ({
        month: formatChartMonth(d.month),
        income: Math.round(d.income * 100) / 100,
        expenses: Math.round(d.expenses * 100) / 100,
      })),
    [chartData],
  );

  const forecastChartData = useMemo(() => {
    if (!forecast || !forecast.days) return [];
    const byMonth: Record<string, { expected: number; best: number; worst: number }> = {};
    for (const day of forecast.days) {
      const key = day.date.slice(0, 7);
      if (!byMonth[key]) byMonth[key] = { expected: 0, best: 0, worst: 0 };
      byMonth[key].expected += day.expectedInflow;
      byMonth[key].best += day.bestInflow;
      byMonth[key].worst += day.worstInflow;
    }
    return Object.entries(byMonth).slice(0, 3).map(([month, v]) => ({
      month: formatChartMonth(month),
      expected: Math.round(v.expected * 100) / 100,
      best: Math.round(v.best * 100) / 100,
      worst: Math.round(v.worst * 100) / 100,
    }));
  }, [forecast]);

  const noData = chartData.length === 0;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border-default bg-surface p-6">
        <h2 className="text-sm font-medium text-text-primary mb-4">
          Income vs Expenses
        </h2>
        {noData ? (
          <p className="text-sm text-text-tertiary py-8 text-center">
            No data yet. Start invoicing to see your income and expenses.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={12} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value) => formatCurrency(Number(value) || 0, baseCurrency)}
                />
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border-default bg-surface p-6">
        <h2 className="text-sm font-medium text-text-primary mb-4">
          Cash Flow Forecast
        </h2>
        {!hasForecastAccess ? (
          <p className="text-sm text-text-tertiary py-8 text-center">
            Upgrade to Pro for cash flow forecasting.
          </p>
        ) : forecastChartData.length === 0 ? (
          <p className="text-sm text-text-tertiary py-8 text-center">
            No forecast data available yet.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={12} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value) => formatCurrency(Number(value) || 0, baseCurrency)}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="expected"
                  name="Expected"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="best"
                  name="Best Case"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.05}
                />
                <Area
                  type="monotone"
                  dataKey="worst"
                  name="Worst Case"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.05}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

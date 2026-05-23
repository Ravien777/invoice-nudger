"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface BenchmarkRow {
  id: string;
  industry: string;
  metric: string;
  value: number;
  sampleSize: number;
  computedAt: string;
}

interface BenchmarksClientProps {
  industry: string | null;
  benchmarks: BenchmarkRow[];
  allBenchmarks: BenchmarkRow[];
}

const METRICS = [
  { key: "avg_days_to_pay", label: "Avg Days to Pay", color: "var(--accent)", format: "days" },
  { key: "collection_rate", label: "Collection Rate", color: "var(--success)", format: "%" },
  { key: "late_payment_percentage", label: "Late Payment %", color: "var(--danger)", format: "%" },
];

const industryLabels: Record<string, string> = {
  freelance_design: "Freelance Design",
  software_dev: "Software Development",
  consulting: "Consulting",
  marketing_agency: "Marketing Agency",
  other: "Other",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function BenchmarksClient({ industry, benchmarks, allBenchmarks }: BenchmarksClientProps) {
  const [activeMetric, setActiveMetric] = useState("avg_days_to_pay");

  const chartData = useMemo(() => {
    const industryMetric = benchmarks.filter((b) => b.metric === activeMetric);
    const allMetric = allBenchmarks.filter((b) => b.metric === activeMetric);

    const dateMap = new Map<string, { industry: number | null; all: number | null; date: string }>();

    for (const b of industryMetric) {
      const key = b.computedAt.slice(0, 10);
      const existing = dateMap.get(key) || { industry: null, all: null, date: key };
      existing.industry = b.value;
      dateMap.set(key, existing);
    }

    for (const b of allMetric) {
      const key = b.computedAt.slice(0, 10);
      const existing = dateMap.get(key) || { industry: null, all: null, date: key };
      existing.all = b.value;
      dateMap.set(key, existing);
    }

    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        date: formatDate(d.date),
        fullDate: d.date,
      }));
  }, [benchmarks, allBenchmarks, activeMetric]);

  if (!industry) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
        <p className="text-muted">
          Set your industry in{" "}
          <a href="/settings" className="text-accent hover:underline">Settings</a>{" "}
          to view benchmark trends.
        </p>
      </div>
    );
  }

  if (benchmarks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
        <p className="text-muted">
          Not enough data in {industryLabels[industry] || industry} yet. Benchmarks are computed daily once enough users are in your industry.
        </p>
      </div>
    );
  }

  const activeBenchmarks = benchmarks.filter((b) => b.metric === activeMetric);
  const latest = activeBenchmarks[0];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          {industryLabels[industry] || industry}
        </h2>
        {latest && (
          <p className="text-sm text-muted">
            Based on {latest.sampleSize} users &middot; Last computed {formatDate(latest.computedAt)}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveMetric(m.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeMetric === m.key
                ? "bg-accent text-surface"
                : "bg-surface text-foreground ring-1 ring-border hover:bg-surface-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="h-80">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickMargin={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickMargin={4}
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
                {chartData.some((d) => d.industry !== null) && (
                  <Line
                    type="monotone"
                    dataKey="industry"
                    name={industryLabels[industry] || industry}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}
                {chartData.some((d) => d.all !== null) && (
                  <Line
                    type="monotone"
                    dataKey="all"
                    name="All Industries"
                    stroke="var(--muted)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted">No trend data available yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

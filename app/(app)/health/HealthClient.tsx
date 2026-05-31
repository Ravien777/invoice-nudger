"use client";

import { useState, useMemo } from "react";
import type { HealthScoreBreakdown } from "@/lib/health-score";
import type { ClientHealthResult } from "@/lib/client-health";

interface HealthClientProps {
  score: number;
  breakdown: HealthScoreBreakdown;
  tips: string[];
  clientScores: ClientHealthResult[];
}

function ScoreRing({ score }: { score: number }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={180} height={180} className="transform -rotate-90">
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          stroke="oklch(0.268 0.007 34.298 / 0.1)"
          strokeWidth={12}
        />
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: 180, height: 180 }}>
        <span className="text-4xl font-bold text-text-primary" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-text-secondary font-medium">/ 100</span>
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  score,
  maxScore,
  details,
  color,
}: {
  label: string;
  score: number;
  maxScore: number;
  details: string;
  color: string;
}) {
  const pct = (score / maxScore) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm font-medium text-text-secondary tabular-nums">
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-text-tertiary">{details}</p>
    </div>
  );
}

function TipCard({ text }: { text: string }) {
  const [headline, ...rest] = text.split(". ");
  const body = rest.join(". ");
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
      <p className="text-sm font-medium text-text-primary mb-1">
        {headline}
        {body ? "." : ""}
      </p>
      {body && <p className="text-xs text-text-secondary">{body}</p>}
    </div>
  );
}

function ClientTable({
  clientScores,
}: {
  clientScores: ClientHealthResult[];
}) {
  const [sortField, setSortField] = useState<"score" | "clientEmail" | "label">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    return [...clientScores].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [clientScores, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const labelColor = (label: string) => {
    switch (label) {
      case "Excellent": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "Good": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "Average": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "Slow Payer": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "High Risk": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  if (clientScores.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No clients with payment history yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default">
            <th
              className="text-left py-3 px-3 font-medium text-text-secondary cursor-pointer hover:text-text-primary"
              onClick={() => toggleSort("clientEmail")}
            >
              Client {sortField === "clientEmail" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </th>
            <th className="text-right py-3 px-3 font-medium text-text-secondary">
              Invoices
            </th>
            <th className="text-right py-3 px-3 font-medium text-text-secondary">
              Avg Days to Pay
            </th>
            <th
              className="text-right py-3 px-3 font-medium text-text-secondary cursor-pointer hover:text-text-primary"
              onClick={() => toggleSort("score")}
            >
              Score {sortField === "score" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </th>
            <th
              className="text-right py-3 px-3 font-medium text-text-secondary cursor-pointer hover:text-text-primary"
              onClick={() => toggleSort("label")}
            >
              Label {sortField === "label" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((client) => (
            <tr key={client.clientEmail} className="border-b border-border-default hover:bg-surface-tertiary/50 transition-colors">
              <td className="py-3 px-3 text-text-primary">{client.clientEmail}</td>
              <td className="py-3 px-3 text-right text-text-secondary tabular-nums">
                {client.invoiceCount > 0 ? client.invoiceCount : "—"}
              </td>
              <td className="py-3 px-3 text-right text-text-secondary tabular-nums">
                {client.breakdown.avgDaysToPay.details}
              </td>
              <td className="py-3 px-3 text-right text-text-primary font-medium tabular-nums">
                {client.score}
              </td>
              <td className="py-3 px-3 text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${labelColor(client.label)}`}
                >
                  {client.label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HealthClient({
  score,
  breakdown,
  tips,
  clientScores,
}: HealthClientProps) {
  return (
    <div className="space-y-8">
      {/* Score + Breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Score ring */}
        <div className="lg:col-span-2 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <ScoreRing score={score} />
          </div>
        </div>

        {/* Progress bars */}
        <div className="lg:col-span-3 space-y-4">
          <ProgressBar
            label="Collection Rate"
            score={breakdown.collectionRate.score}
            maxScore={breakdown.collectionRate.maxScore}
            details={breakdown.collectionRate.details}
            color="#22c55e"
          />
          <ProgressBar
            label="Avg Days to Payment"
            score={breakdown.avgDaysToPay.score}
            maxScore={breakdown.avgDaysToPay.maxScore}
            details={breakdown.avgDaysToPay.details}
            color="#3b82f6"
          />
          <ProgressBar
            label="Revenue Consistency"
            score={breakdown.revenueConsistency.score}
            maxScore={breakdown.revenueConsistency.maxScore}
            details={breakdown.revenueConsistency.details}
            color="#8b5cf6"
          />
          <ProgressBar
            label="Expense Ratio"
            score={breakdown.expenseRatio.score}
            maxScore={breakdown.expenseRatio.maxScore}
            details={breakdown.expenseRatio.details}
            color="#f59e0b"
          />
          <ProgressBar
            label="Tax Reserve Coverage"
            score={breakdown.taxReserve.score}
            maxScore={breakdown.taxReserve.maxScore}
            details={breakdown.taxReserve.details}
            color="#06b6d4"
          />
        </div>
      </div>

      {/* Tips */}
      {tips.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-text-primary">
            Improvement Tips
          </h3>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <TipCard key={i} text={tip} />
            ))}
          </div>
        </div>
      )}

      {/* Client Health Table */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">
          Client Health
        </h3>
        <p className="text-sm text-text-secondary">
          Sortable overview of each client&apos;s payment reliability and risk level.
        </p>
        <div className="bg-surface-secondary border border-border-default rounded-lg overflow-hidden">
          <ClientTable clientScores={clientScores} />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This score is for your reference only. It is not a credit score and is not
          shared with any third party. Scores are calculated from your invoice and
          expense history in Maroni.
        </p>
      </div>
    </div>
  );
}

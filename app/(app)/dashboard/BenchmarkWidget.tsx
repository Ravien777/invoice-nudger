"use client";

interface BenchmarkData {
  userValue: number;
  industryValue: number;
  metric: string;
  label: string;
  higherIsBetter: boolean;
  format: "days" | "percentage";
}

interface BenchmarkWidgetProps {
  benchmarks: BenchmarkData[];
  industry: string | null;
  hasEnoughData: boolean;
}

function formatVal(val: number, fmt: "days" | "percentage"): string {
  if (fmt === "days") return val.toFixed(1) + "d";
  return val.toFixed(0) + "%";
}

const industryLabels: Record<string, string> = {
  freelance_design: "Freelance Design",
  software_dev: "Software Development",
  consulting: "Consulting",
  marketing_agency: "Marketing Agency",
  other: "Other",
};

export default function BenchmarkWidget({ benchmarks, industry, hasEnoughData }: BenchmarkWidgetProps) {
  if (!industry) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <h2 className="text-sm font-medium text-text-secondary">Industry Benchmarks</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Set your industry in{" "}
          <a href="/settings" className="text-accent hover:underline">Settings</a>{" "}
          to compare your performance against peers.
        </p>
      </div>
    );
  }

  if (!hasEnoughData) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <h2 className="text-sm font-medium text-text-secondary">Industry Benchmarks</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Not enough data in {industryLabels[industry] || industry} yet. Benchmarks are computed daily once enough users are in your industry.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-medium text-text-secondary">
        Industry Benchmarks \u2014 {industryLabels[industry] || industry}
      </h2>
      <div className="space-y-4">
        {benchmarks.map((b) => {
          const diff = b.userValue - b.industryValue;
          const absDiff = Math.abs(diff);
          const isBetter = b.higherIsBetter ? diff > 0 : diff < 0;
          const userPct = b.industryValue > 0 ? (b.userValue / b.industryValue) * 100 : 0;

          return (
            <div key={b.metric}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-text-primary">{b.label}</span>
                <span className={isBetter ? "text-success" : "text-danger"}>
                  {isBetter ? "\u25B2" : "\u25BC"} {absDiff.toFixed(1)}{b.format === "days" ? "d" : "%"} {isBetter ? "better" : "worse"}
                </span>
              </div>
              <div className="relative h-5 w-full overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-success/10"
                  style={{ width: `${Math.min(userPct, 100)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-medium text-text-secondary">
                  <span>You: {formatVal(b.userValue, b.format)}</span>
                  <span>Avg: {formatVal(b.industryValue, b.format)}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

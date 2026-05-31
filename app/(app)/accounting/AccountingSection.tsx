import { computeForecast } from "@/lib/forecast";
import { getTier } from "@/lib/subscriptions";
import nextDynamic from "next/dynamic";

const AccountingCharts = nextDynamic(() => import("./AccountingCharts"), {
  loading: () => (
    <div className="h-80 rounded-xl bg-surface-muted animate-pulse" />
  ),
});

export async function AccountingSection({
  userId,
  chartData,
  baseCurrency,
  plan,
}: {
  userId: string;
  chartData: { month: string; income: number; expenses: number }[];
  baseCurrency: string;
  plan: string;
}) {
  const forecast = await computeForecast(userId);
  const hasForecastAccess = getTier(plan).features.includes("cash_flow_forecast");

  return (
    <AccountingCharts
      chartData={chartData}
      forecast={forecast}
      hasForecastAccess={hasForecastAccess}
      baseCurrency={baseCurrency}
    />
  );
}

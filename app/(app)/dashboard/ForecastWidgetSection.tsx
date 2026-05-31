import { computeForecast } from "@/lib/forecast";
import { getTier } from "@/lib/subscriptions";
import nextDynamic from "next/dynamic";

const ForecastWidget = nextDynamic(() => import("./ForecastWidget"));

export default async function ForecastWidgetSection({
  userId, plan, baseCurrency,
}: {
  userId: string; plan: string; baseCurrency: string;
}) {
  const forecast = await computeForecast(userId);
  const hasAccess = getTier(plan).features.includes("cash_flow_forecast");

  return (
    <div className="mb-8">
      <ForecastWidget
        forecast={forecast}
        hasAccess={hasAccess}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}

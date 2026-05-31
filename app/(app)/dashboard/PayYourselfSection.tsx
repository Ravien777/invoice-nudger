import { calculatePayYourselfAmount } from "@/lib/pay-yourself";
import { getTier } from "@/lib/subscriptions";
import PayYourselfWidget from "./PayYourselfWidget";

export default async function PayYourselfSection({
  userId, plan, baseCurrency,
}: {
  userId: string; plan: string; baseCurrency: string;
}) {
  const payYourself = await calculatePayYourselfAmount(userId);
  const hasAccess = getTier(plan).features.includes("cash_flow_forecast");

  return (
    <div className="mb-8 max-w-md">
      <PayYourselfWidget
        available={payYourself.available}
        baseCurrency={baseCurrency}
        hasAccess={hasAccess}
      />
    </div>
  );
}

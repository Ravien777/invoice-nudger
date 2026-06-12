import { NextResponse } from "next/server";
import { getDueInstallments, chargeInstallment, handleInstallmentSuccess, handleInstallmentFailure } from "@/lib/payment-plan";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ installmentId: string; status: string; error?: string }> = [];

  const installments = await getDueInstallments();

  for (const installment of installments) {
    try {
      const { paymentIntent } = await chargeInstallment(installment.id);

      if (paymentIntent.status === "succeeded") {
        await handleInstallmentSuccess(installment.id, paymentIntent);
        results.push({ installmentId: installment.id, status: "succeeded" });
      } else {
        await handleInstallmentFailure(installment.id, paymentIntent);
        results.push({ installmentId: installment.id, status: paymentIntent.status });
      }
    } catch (err) {
      console.error(`Installment charge failed for ${installment.id}:`, err);
      results.push({
        installmentId: installment.id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ processed: installments.length, results });
}

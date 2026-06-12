import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultPaymentMethod, chargeClient, handleChargeSuccess, handleChargeFailure, canAutoCharge } from "@/lib/auto-charge";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ invoiceId: string; status: string }> = [];

  const invoices = await prisma.invoice.findMany({
    where: {
      autoCharge: true,
      status: { not: "paid" },
      dueDate: { lte: new Date() },
      clientEmail: { not: "" },
    },
  });

  for (const invoice of invoices) {
    try {
      const usage = await canAutoCharge(invoice.userId);
      if (!usage.allowed) {
        results.push({ invoiceId: invoice.id, status: "limit_reached" });
        continue;
      }

      const cpm = await getDefaultPaymentMethod(invoice.userId, invoice.clientEmail);
      if (!cpm) {
        results.push({ invoiceId: invoice.id, status: "no_payment_method" });
        continue;
      }

      const paymentIntent = await chargeClient(
        cpm.id,
        invoice.amount,
        invoice.currency,
        invoice.id,
        `Auto-charge: ${invoice.clientName}`,
      );

      if (paymentIntent.status === "succeeded") {
        await handleChargeSuccess(paymentIntent);
        results.push({ invoiceId: invoice.id, status: "succeeded" });
      } else {
        await handleChargeFailure(paymentIntent);
        results.push({ invoiceId: invoice.id, status: paymentIntent.status });
      }
    } catch (err) {
      console.error(`Auto-charge failed for invoice ${invoice.id}:`, err);

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          autoChargeRetryCount: { increment: 1 },
          autoChargeLastError: err instanceof Error ? err.message : "Unknown error",
          autoChargeLastAttemptAt: new Date(),
        },
      });

      results.push({ invoiceId: invoice.id, status: "error" });
    }
  }

  return NextResponse.json({ processed: invoices.length, results });
}

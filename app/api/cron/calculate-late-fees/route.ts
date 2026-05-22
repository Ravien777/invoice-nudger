import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const feeInvoices = await prisma.invoice.findMany({
    where: {
      lateFeeEnabled: true,
      status: { in: ["unpaid", "overdue"] },
    },
    include: {
      user: true,
    },
  });

  let lateFeesApplied = 0;
  let interestAccrued = 0;
  let capped = 0;
  let skipped = 0;
  let errors = 0;
  const results: Array<{
    invoiceId: string;
    invoiceNumber: string | null;
    lateFeeApplied: number;
    interestAccrued: number;
    totalFees: number;
    capped: boolean;
  }> = [];

  for (const invoice of feeInvoices) {
    try {
      const dueDate = new Date(
        Date.UTC(
          invoice.dueDate.getUTCFullYear(),
          invoice.dueDate.getUTCMonth(),
          invoice.dueDate.getUTCDate()
        )
      );

      const graceEnd = new Date(dueDate.getTime());
      graceEnd.setUTCDate(graceEnd.getUTCDate() + invoice.user.lateFeeGraceDays);

      if (today <= graceEnd) {
        skipped++;
        continue;
      }

      let newFees = 0;
      let lateFeeApplied = 0;
      let interestApplied = 0;

      const lastCalc = invoice.lastFeeCalculation
        ? new Date(invoice.lastFeeCalculation)
        : null;

      const isLateFeePending =
        invoice.user.lateFeeType === "fixed"
          ? invoice.user.lateFeeValue > 0 && invoice.accruedFees < invoice.user.lateFeeValue
          : invoice.user.lateFeeValue > 0 && invoice.accruedFees < (invoice.user.lateFeeValue / 100) * invoice.amount;

      if (isLateFeePending && invoice.user.lateFeeEnabled) {
        if (invoice.user.lateFeeFrequency === "once") {
          const feeAmount =
            invoice.user.lateFeeType === "fixed"
              ? invoice.user.lateFeeValue
              : (invoice.user.lateFeeValue / 100) * invoice.amount;
          newFees += feeAmount;
          lateFeeApplied = feeAmount;
        } else if (invoice.user.lateFeeFrequency === "recurring") {
          if (!lastCalc || isNewPeriod(lastCalc, today)) {
            const feeAmount =
              invoice.user.lateFeeType === "fixed"
                ? invoice.user.lateFeeValue
                : (invoice.user.lateFeeValue / 100) * invoice.amount;
            newFees += feeAmount;
            lateFeeApplied = feeAmount;
          }
        }
      }

      if (invoice.user.interestEnabled && invoice.user.interestRate > 0) {
        const calcStart = lastCalc || graceEnd;
        const daysSinceCalc = Math.max(
          0,
          Math.floor(
            (today.getTime() - calcStart.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        if (daysSinceCalc > 0) {
          const interest =
            (invoice.user.interestRate / 100) * invoice.amount * daysSinceCalc;
          newFees += interest;
          interestApplied = interest;
        }
      }

      if (newFees === 0) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { lastFeeCalculation: today },
        });
        skipped++;
        continue;
      }

      const totalAccrued = invoice.accruedFees + newFees;
      const cap = invoice.user.feeCap;
      const isCapped = cap > 0 && totalAccrued > cap;

      const appliedFees = isCapped ? Math.max(0, cap - invoice.accruedFees) : newFees;

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          accruedFees: { increment: appliedFees },
          lastFeeCalculation: today,
        },
      });

      if (isCapped) {
        capped++;
      }
      if (lateFeeApplied > 0) lateFeesApplied++;
      if (interestApplied > 0) interestAccrued++;

      results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        lateFeeApplied,
        interestAccrued: interestApplied,
        totalFees: appliedFees,
        capped: isCapped,
      });
    } catch (err) {
      errors++;
      console.error("Fee calculation error for invoice", invoice.id, err);
    }
  }

  return NextResponse.json({
    date: today.toISOString(),
    summary: {
      processed: feeInvoices.length,
      lateFeesApplied,
      interestAccrued,
      capped,
      skipped,
      errors,
    },
    results,
  });
}

function isNewPeriod(lastCalc: Date, today: Date): boolean {
  return today.getTime() - lastCalc.getTime() >= 30 * 24 * 60 * 60 * 1000;
}

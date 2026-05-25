import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, addMonths, addYears, setDate } from "date-fns";

const CRON_SECRET = process.env.CRON_SECRET;

function computeNextRunDate(
  frequency: string,
  dayOfMonth?: number,
  from: Date = new Date(),
): Date {
  switch (frequency) {
    case "weekly":
      return addDays(from, 7);
    case "biweekly":
      return addDays(from, 14);
    case "monthly":
      return setDate(addMonths(from, 1), Math.min(dayOfMonth ?? 1, 28));
    case "quarterly":
      return addDays(from, 90);
    case "annually":
      return addYears(from, 1);
    default:
      return addDays(from, 7);
  }
}

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = await prisma.recurringInvoice.findMany({
    where: {
      status: "active",
      nextRunDate: { lte: today },
    },
  });

  let created = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const rec of due) {
    try {
      await prisma.invoice.create({
        data: {
          clientName: rec.clientName,
          clientEmail: rec.clientEmail,
          clientPhone: rec.clientPhone,
          amount: rec.amount,
          currency: rec.currency,
          dueDate: addDays(today, 30),
          status: "unpaid",
          userId: rec.userId,
        },
      });

      const newNextRun = computeNextRunDate(rec.frequency, rec.dayOfMonth ?? undefined, rec.nextRunDate);

      const updateData: Record<string, unknown> = {
        invoicesCreated: { increment: 1 },
        lastRunDate: today,
        nextRunDate: newNextRun,
      };

      if (rec.endDate && newNextRun > rec.endDate) {
        updateData.status = "cancelled";
      }

      await prisma.recurringInvoice.update({
        where: { id: rec.id },
        data: updateData as any,
      });

      created++;
    } catch (err) {
      errors.push({ id: rec.id, error: String(err) });
    }
  }

  return NextResponse.json({
    processed: due.length,
    created,
    errors: errors.length > 0 ? errors : undefined,
  });
}

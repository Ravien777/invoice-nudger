import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";

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

  const unpaidInvoices = await prisma.invoice.findMany({
    where: { status: "unpaid" },
    include: {
      user: true,
      reminderSchedule: {
        include: { steps: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const results: Array<{
    invoiceId: string;
    invoiceNumber: string | null;
    clientName: string;
    step: string;
    status: "sent" | "skipped" | "error";
    reason?: string;
  }> = [];

  for (const invoice of unpaidInvoices) {
    const schedule =
      invoice.reminderSchedule ??
      (await prisma.reminderSchedule.findFirst({
        where: { userId: invoice.userId, isDefault: true },
        include: { steps: true },
      }));

    if (!schedule) {
      results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        step: "none",
        status: "skipped",
        reason: "No schedule found",
      });
      skipped++;
      continue;
    }

    const existingLogs = await prisma.reminderLog.findMany({
      where: { invoiceId: invoice.id },
      select: { stepName: true },
    });
    const sentSteps = new Set(existingLogs.map((l: { stepName: string }) => l.stepName));

    for (const step of schedule.steps) {
      if (sentSteps.has(step.emailTemplate)) {
        continue;
      }

      const stepDueDate = new Date(
        Date.UTC(
          invoice.dueDate.getUTCFullYear(),
          invoice.dueDate.getUTCMonth(),
          invoice.dueDate.getUTCDate() + step.daysOffset
        )
      );

      if (stepDueDate.getTime() !== today.getTime()) {
        continue;
      }

      const result = await sendReminderEmail(
        {
          id: invoice.id,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          invoiceNumber: invoice.invoiceNumber,
        },
        { emailTemplate: step.emailTemplate }
      );

      if (result.success) {
        sent++;
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          step: step.emailTemplate,
          status: "sent",
        });

        if (step.daysOffset > 0) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "overdue" },
          });
        }
      } else {
        errors++;
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          step: step.emailTemplate,
          status: "error",
          reason: result.error,
        });
      }
    }
  }

  return NextResponse.json({
    date: today.toISOString(),
    summary: { sent, skipped, errors },
    results,
  });
}

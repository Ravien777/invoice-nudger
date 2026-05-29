import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { computeNextRunDate } from "@/lib/date-utils";
import { canCreateInvoice } from "@/lib/subscriptions";

const CRON_SECRET = process.env.CRON_SECRET;

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
      let nextRun = rec.nextRunDate;
      let backfillCount = 0;
      const recLineItems = rec.lineItems as Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number; total: number; sortOrder: number }> | null;

      while (nextRun <= today && backfillCount < 3) {
        const { allowed } = await canCreateInvoice(rec.userId, 1);
        if (!allowed) {
          errors.push({ id: rec.id, error: "Invoice limit reached" });
          break;
        }

        const invoice = await prisma.invoice.create({
          data: {
            clientName: rec.clientName,
            clientEmail: rec.clientEmail,
            clientPhone: rec.clientPhone,
            amount: rec.amount,
            currency: rec.currency,
            dueDate: addDays(nextRun, 30),
            status: "unpaid",
            userId: rec.userId,
            reminderScheduleId: rec.reminderScheduleId,
            notes: rec.description || undefined,
            lineItems: recLineItems && recLineItems.length > 0
              ? { create: recLineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, taxRate: li.taxRate ?? undefined, total: li.total, sortOrder: li.sortOrder })) }
              : undefined,
          },
        });

        if (rec.autoSend) {
          try {
            const { Resend } = await import("resend");
            const client = new Resend(process.env.RESEND_API_KEY ?? "");
            const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
            const paymentLink = `${baseUrl}/pay/${invoice.id}`;
            await client.emails.send({
              from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
              to: rec.clientEmail,
              subject: `New invoice from ${rec.description || "Maroni"}`,
              html: `
                <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
                  <p>Hi ${rec.clientName},</p>
                  <p>A new invoice for <strong>${new Intl.NumberFormat("en-US", { style: "currency", currency: rec.currency }).format(rec.amount)}</strong> has been created.</p>
                  ${rec.description ? `<p>${rec.description}</p>` : ""}
                  <p style="margin-top: 24px;">
                    <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Pay Now</a>
                  </p>
                  <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If you have any questions, feel free to reply to this email.</p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error("Failed to send auto-generated invoice email:", emailErr);
          }
        }

        nextRun = computeNextRunDate(rec.frequency, rec.dayOfMonth ?? undefined, nextRun);
        backfillCount++;
      }

      const updateData: Record<string, unknown> = {
        invoicesCreated: { increment: backfillCount },
        lastRunDate: today,
        nextRunDate: nextRun,
      };

      if (rec.endDate && nextRun > rec.endDate) {
        updateData.status = "cancelled";
      }

      await prisma.recurringInvoice.update({
        where: { id: rec.id },
        data: updateData as any,
      });

      created += backfillCount;
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

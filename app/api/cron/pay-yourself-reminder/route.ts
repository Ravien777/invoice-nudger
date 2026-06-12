import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePayYourselfAmount } from "@/lib/pay-yourself";
import { formatCurrency } from "@/lib/format-currency";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cronSecret !== "skip") {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const proUsers = await prisma.user.findMany({
    where: {
      plan: { in: ["pro", "agency"] },
      businessProfile: {
        OR: [
          { lastPayYourselfDate: null },
          { lastPayYourselfDate: { lte: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) } },
        ],
      },
    },
    select: { id: true, name: true, email: true, businessProfile: { select: { baseCurrency: true, lastPayYourselfDate: true } }, allocationProfile: { select: { ownerPayPercent: true } } },
    take: 1000,
  });

  const results: Array<{ userId: string; available: number; notified: boolean }> = [];

  for (const user of proUsers) {
    try {
      const { available } = await calculatePayYourselfAmount(user.id);
      const currency = user.businessProfile?.baseCurrency ?? "USD";
      const ownerPct = user.allocationProfile?.ownerPayPercent ?? 40;

      if (available > 0) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "pay_yourself",
            title: "Time to pay yourself 💸",
            message: `You have ${formatCurrency(available, currency)} available to pay yourself this month (${ownerPct}% owner split).`,
            metadata: { available, type: "pay_yourself" },
          },
        });

        if (user.email) {
          try {
            await resend.emails.send({
              from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
              to: user.email,
              subject: "Time to pay yourself 💸",
              html: `<p>You have <strong>${formatCurrency(available, currency)}</strong> available to pay yourself (${ownerPct}% owner split).</p>`,
            });
          } catch {
            // email is best-effort
          }
        }

        results.push({ userId: user.id, available, notified: true });
      } else {
        results.push({ userId: user.id, available, notified: false });
      }
    } catch {
      results.push({ userId: user.id, available: 0, notified: false });
    }
  }

  return NextResponse.json({
    processed: proUsers.length,
    notified: results.filter((r) => r.notified).length,
    results,
  });
}

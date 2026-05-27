import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePayYourselfAmount } from "@/lib/pay-yourself";
import { formatCurrency } from "@/lib/format-currency";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (CRON_SECRET && CRON_SECRET !== "skip") {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const proUsers = await prisma.user.findMany({
    where: {
      plan: { in: ["pro", "agency"] },
      OR: [
        { lastPayYourselfDate: null },
        { lastPayYourselfDate: { lte: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) } },
      ],
    },
    select: { id: true, name: true, baseCurrency: true },
  });

  const results: Array<{ userId: string; available: number; notified: boolean }> = [];

  for (const user of proUsers) {
    try {
      const { available } = await calculatePayYourselfAmount(user.id);

      if (available > 0) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "pay_yourself",
            title: "Time to pay yourself",
            message: `You have ${formatCurrency(available, user.baseCurrency)} available to pay yourself this month.`,
            metadata: { available, type: "pay_yourself" },
          },
        });
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

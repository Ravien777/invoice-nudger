import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/plazaos-auth";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [monthlyInvoices, outstandingInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      select: { amount: true },
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: ["pending", "overdue", "unpaid"] },
      },
      select: { amount: true },
    }),
  ]);

  const monthlyRevenue = monthlyInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const outstandingTotal = outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return NextResponse.json({ monthlyRevenue, outstandingTotal });
}

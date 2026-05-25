import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getTaxYearRange(user: { fiscalYearStart: number }, year: number) {
  const startMonth = user.fiscalYearStart - 1;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year + 1, startMonth, 1);
  return { start, end };
}

function currentTaxYear(user: { fiscalYearStart: number }) {
  const now = new Date();
  const startMonth = user.fiscalYearStart - 1;
  const year = now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
  return year;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, taxRate: true, fiscalYearStart: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(currentTaxYear(user)), 10);
  const { start, end } = getTaxYearRange(user, year);

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        userId: user.id,
        status: "paid",
        paidAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        userId: user.id,
        taxDeductible: true,
        date: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const grossIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const taxableIncome = Math.max(0, grossIncome - totalExpenses);
  const taxRate = user.taxRate;
  const estimatedTax = taxableIncome * taxRate;

  const taxSavings = await prisma.user.findUnique({
    where: { id: user.id },
    select: { taxSavingsAmount: true },
  });

  return NextResponse.json({
    year,
    grossIncome,
    totalExpenses,
    taxableIncome,
    estimatedTax,
    taxRate,
    taxSavingsAmount: taxSavings?.taxSavingsAmount ?? 0,
    currency: "USD",
  });
}

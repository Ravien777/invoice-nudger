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

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const { start, end } = getTaxYearRange(user, year);

  const [paidInvoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: "paid",
        paidAt: { gte: start, lt: end },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        date: { gte: start, lt: end },
      },
      select: { amount: true, date: true, taxDeductible: true, category: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const incomeByMonth: Record<string, { count: number; total: number }> = {};
  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue;
    const key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (!incomeByMonth[key]) incomeByMonth[key] = { count: 0, total: 0 };
    incomeByMonth[key].count += 1;
    incomeByMonth[key].total += inv.amount;
  }

  const expensesByCategory: Record<string, { count: number; total: number; taxDeductible: number }> = {};
  for (const exp of expenses) {
    const key = exp.category?.name || "Uncategorised";
    if (!expensesByCategory[key]) expensesByCategory[key] = { count: 0, total: 0, taxDeductible: 0 };
    expensesByCategory[key].count += 1;
    expensesByCategory[key].total += exp.amount;
    if (exp.taxDeductible) expensesByCategory[key].taxDeductible += exp.amount;
  }

  const incomeEntries = Object.entries(incomeByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, invoices: data.count, total: data.total }));

  const expenseEntries = Object.entries(expensesByCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, data]) => ({ category, items: data.count, total: data.total, taxDeductible: data.taxDeductible }));

  const totalIncome = incomeEntries.reduce((s, e) => s + e.total, 0);
  const totalExpenses = expenseEntries.reduce((s, e) => s + e.total, 0);
  const netProfit = totalIncome - totalExpenses;
  const estimatedTax = Math.max(0, netProfit) * user.taxRate;

  return NextResponse.json({
    year,
    income: incomeEntries,
    expenses: expenseEntries,
    summary: {
      totalIncome,
      totalExpenses,
      netProfit,
      estimatedTax,
      taxRate: user.taxRate,
    },
  });
}

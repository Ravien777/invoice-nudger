import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { getTaxYearRange } from "@/lib/tax-utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  const lookupEmail = accountantOwnerId
    ? (await prisma.user.findUnique({ where: { id: accountantOwnerId }, select: { email: true } }))?.email
    : session.user.email;

  const user = await prisma.user.findUnique({
    where: { email: lookupEmail ?? session.user.email },
    include: { businessProfile: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const bp = user.businessProfile ?? { taxRate: 0.25, fiscalYearStart: 1 };

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  let { start, end } = getTaxYearRange(bp.fiscalYearStart, year);
  const month = req.nextUrl.searchParams.get("month");
  if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) {
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
    }
  }

  const effectiveUserId = accountantOwnerId ?? user.id;

  const [paidInvoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId: effectiveUserId,
        status: "paid",
        paidAt: { gte: start, lt: end },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        userId: effectiveUserId,
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
  const estimatedTax = Math.max(0, netProfit) * bp.taxRate;

  return NextResponse.json({
    year,
    income: incomeEntries,
    expenses: expenseEntries,
    summary: {
      totalIncome,
      totalExpenses,
      netProfit,
      estimatedTax,
      taxRate: bp.taxRate,
    },
  }, {
    headers: { "Cache-Control": "private, s-maxage=3600, stale-while-revalidate=600" },
  });
}

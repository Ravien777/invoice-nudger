import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";
import { Suspense } from "react";
import { PageShell } from "@/app/components/layout/PageShell";
import { StatCard } from "@/app/components/ui/StatCard";
import { formatCurrency } from "@/lib/format-currency";
import { AccountingSection } from "./AccountingSection";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });
  if (!user) redirect("/");

  const bp = user.businessProfile ?? { baseCurrency: "USD" };

  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [paidThisYear, expensesThisYear, paidThisMonth, expensesThisMonth, outstandingByCurrency] =
    await Promise.all([
      prisma.invoice.findMany({
        where: {
          userId: user.id,
          status: "paid",
          paidAt: { gte: yearStart, lt: yearEnd },
        },
        select: { amount: true, paidAt: true, currency: true },
      }),
      prisma.expense.findMany({
        where: {
          userId: user.id,
          date: { gte: yearStart, lt: yearEnd },
        },
        select: { amount: true, date: true, currency: true },
      }),
      prisma.invoice.findMany({
        where: {
          userId: user.id,
          status: "paid",
          paidAt: { gte: monthStart, lt: monthEnd },
        },
        select: { amount: true, paidAt: true, currency: true },
      }),
      prisma.expense.findMany({
        where: {
          userId: user.id,
          date: { gte: monthStart, lt: monthEnd },
        },
        select: { amount: true, date: true, currency: true },
      }),
      prisma.invoice.groupBy({
        by: ["currency"],
        where: { userId: user.id, status: { in: ["unpaid", "overdue"] } },
        _sum: { amount: true },
      }),
    ]);

  const yearlyIncome = paidThisYear.reduce((s, i) => s + i.amount, 0);
  const yearlyExpenses = expensesThisYear.reduce((s, e) => s + e.amount, 0);
  const monthlyIncome = paidThisMonth.reduce((s, i) => s + i.amount, 0);
  const monthlyExpenses = expensesThisMonth.reduce((s, e) => s + e.amount, 0);

  const outstandingTotal = outstandingByCurrency.reduce(
    (s, g) => s + (g._sum.amount ?? 0), 0,
  );

  const incomeByMonth: Record<string, number> = {};
  for (const inv of paidThisYear) {
    if (!inv.paidAt) continue;
    const key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, "0")}`;
    incomeByMonth[key] = (incomeByMonth[key] || 0) + inv.amount;
  }

  const expensesByMonth: Record<string, number> = {};
  for (const exp of expensesThisYear) {
    const key = `${exp.date.getFullYear()}-${String(exp.date.getMonth() + 1).padStart(2, "0")}`;
    expensesByMonth[key] = (expensesByMonth[key] || 0) + exp.amount;
  }

  const allMonths = new Set([...Object.keys(incomeByMonth), ...Object.keys(expensesByMonth)]);
  const chartData = Array.from(allMonths).sort().map((month) => ({
    month,
    income: incomeByMonth[month] || 0,
    expenses: expensesByMonth[month] || 0,
  }));

  return (
    <PageShell
      title="Accounting"
      subtitle="Income, expenses, and cash flow at a glance."
    >
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Revenue This Year"
            value={formatCurrency(yearlyIncome, bp.baseCurrency)}
            variant="default"
          />
          <StatCard
            label="Expenses This Year"
            value={formatCurrency(yearlyExpenses, bp.baseCurrency)}
            variant="default"
          />
          <StatCard
            label="Net Income"
            value={formatCurrency(yearlyIncome - yearlyExpenses, bp.baseCurrency)}
            variant={yearlyIncome >= yearlyExpenses ? "default" : "warning"}
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(outstandingTotal, bp.baseCurrency)}
            variant="warning"
          />
        </div>

        <Suspense fallback={<div className="h-80 rounded-xl bg-surface-muted animate-pulse" />}>
          <AccountingSection
            userId={user.id}
            chartData={chartData}
            baseCurrency={bp.baseCurrency}
            plan={user.plan}
          />
        </Suspense>
      </div>
    </PageShell>
  );
}

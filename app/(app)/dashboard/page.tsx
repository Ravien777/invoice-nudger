import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, subMonths, differenceInCalendarDays, subDays, format } from "date-fns";
import Link from "next/link";
import { Plus, FileText, AlertCircle, CheckCircle, Receipt } from "lucide-react";
import DashboardClient from "./DashboardClient";
import { getTier } from "@/lib/subscriptions";
import BenchmarkWidget from "./BenchmarkWidget";
import { computeForecast } from "@/lib/forecast";
import ForecastWidget from "./ForecastWidget";
import EfficiencyWidget from "./EfficiencyWidget";
import { computeCollectionEfficiencyForUser } from "@/lib/analytics";
import { calculatePayYourselfAmount } from "@/lib/pay-yourself";
import PayYourselfWidget from "./PayYourselfWidget";
import { PageShell } from "@/app/components/layout/PageShell";
import { Button } from "@/app/components/ui/Button";
import { StatCard } from "@/app/components/ui/StatCard";
import { Badge, type BadgeVariant } from "@/app/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format-currency";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });

  const bp = user!.businessProfile ?? { baseCurrency: "USD" };

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));

  const [unpaidCount, overdueCount, paidThisMonth, totalInvoices, monthlyInvoiceCount, reconciledCount, discrepancyCount, outstandingByCurrency, recentInvoices, paidLastMonth, expenseAgg] =
    await Promise.all([
      prisma.invoice.count({
        where: { userId: user!.id, status: "unpaid" },
      }),
      prisma.invoice.count({
        where: { userId: user!.id, status: "overdue" },
      }),
      prisma.invoice.count({
        where: {
          userId: user!.id,
          status: "paid",
          updatedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.invoice.count({
        where: { userId: user!.id },
      }),
      prisma.invoice.count({
        where: {
          userId: user!.id,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.invoice.count({
        where: { userId: user!.id, reconciliationStatus: "reconciled" },
      }),
      prisma.invoice.count({
        where: { userId: user!.id, reconciliationStatus: "discrepancy" },
      }),
      prisma.invoice.groupBy({
        by: ["currency"],
        where: { userId: user!.id, status: { in: ["unpaid", "overdue"] } },
        _sum: { amount: true },
      }),
      prisma.invoice.findMany({
        where: { userId: user!.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, invoiceNumber: true, clientName: true, amount: true, currency: true, status: true, dueDate: true },
      }),
      prisma.invoice.count({
        where: {
          userId: user!.id,
          status: "paid",
          updatedAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      prisma.expense.aggregate({
        where: { userId: user!.id, date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  const userPaidInvoices = await prisma.invoice.findMany({
    where: { userId: user!.id, status: "paid", paidAt: { not: null } },
    select: { dueDate: true, paidAt: true, amount: true },
  });

  const userDaysToPay = userPaidInvoices
    .map((inv) => differenceInCalendarDays(inv.paidAt!, inv.dueDate))
    .filter((d) => d !== null);
  const userAvgDaysToPay = userDaysToPay.length > 0
    ? userDaysToPay.reduce((a, b) => a + b, 0) / userDaysToPay.length
    : 0;
  const userLatePct = userDaysToPay.length > 0
    ? (userDaysToPay.filter((d) => d > 0).length / userDaysToPay.length) * 100
    : 0;

  const userOldInvoices = await prisma.invoice.count({
    where: { userId: user!.id, createdAt: { lte: subDays(new Date(), 90) } },
  });
  const userOldPaid = await prisma.invoice.count({
    where: { userId: user!.id, status: "paid", createdAt: { lte: subDays(new Date(), 90) } },
  });
  const userCollectionRate = userOldInvoices > 0 ? (userOldPaid / userOldInvoices) * 100 : 0;

  let benchmarkData: Array<{ userValue: number; industryValue: number; metric: string; label: string; higherIsBetter: boolean; format: "days" | "percentage" }> = [];
  let hasEnoughBenchmarks = false;

  const targetIndustry = user!.industry;
  if (targetIndustry) {
    const benchmarks = await prisma.industryBenchmark.findMany({
      where: { industry: targetIndustry },
      orderBy: { computedAt: "desc" },
      take: 4,
    });

    if (benchmarks.length >= 4) {
      hasEnoughBenchmarks = true;
      const bm = new Map(benchmarks.map((b) => [b.metric, b]));
      benchmarkData = [
        {
          metric: "avg_days_to_pay",
          label: "Avg Days to Pay",
          userValue: userAvgDaysToPay,
          industryValue: bm.get("avg_days_to_pay")?.value ?? 0,
          higherIsBetter: false,
          format: "days",
        },
        {
          metric: "collection_rate",
          label: "Collection Rate (90d)",
          userValue: userCollectionRate,
          industryValue: bm.get("collection_rate")?.value ?? 0,
          higherIsBetter: true,
          format: "percentage",
        },
        {
          metric: "late_payment_percentage",
          label: "Late Payment %",
          userValue: userLatePct,
          industryValue: bm.get("late_payment_percentage")?.value ?? 0,
          higherIsBetter: false,
          format: "percentage",
        },
      ];
    }
  }

  const forecast = await computeForecast(user!.id);
  const hasForecastAccess = getTier(user!.plan).features.includes("cash_flow_forecast");

  const efficiencyMetrics = await computeCollectionEfficiencyForUser(user!.id);

  const payYourself = await calculatePayYourselfAmount(user!.id);
  const tier = getTier(user!.plan);
  const usagePercent = tier.invoiceLimit
    ? Math.min((monthlyInvoiceCount / tier.invoiceLimit) * 100, 100)
    : 0;

  const paidTrend =
    paidThisMonth !== paidLastMonth
      ? {
          value: `${Math.abs(paidThisMonth - paidLastMonth)}`,
          positive: paidThisMonth > paidLastMonth,
        }
      : undefined;

  const outstandingLines = outstandingByCurrency.length > 0
    ? outstandingByCurrency.map((g) => formatCurrency(g._sum.amount ?? 0, g.currency))
    : [];
  const hasMultiCurrency = outstandingByCurrency.length > 1;
  const outstandingFormatted = hasMultiCurrency
    ? outstandingLines.join(" | ")
    : outstandingLines[0] || "$0";

  if (totalInvoices === 0) {
    return (
      <PageShell
        title="Dashboard"
        subtitle="Overview of your invoices"
        actions={
          <Button href="/invoices/new" size="sm">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        }
      >
        <DashboardClient>
          <EmptyState
            title="No invoices yet"
            description="Get started by creating your first invoice."
            action={{ label: "New Invoice", href: "/invoices/new" }}
          >
            <FileText className="h-12 w-12 text-text-tertiary" />
          </EmptyState>
        </DashboardClient>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Dashboard"
      subtitle="Overview of your invoices"
      actions={
        <Button href="/invoices/new" size="sm">
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      }
    >
      <DashboardClient>
        {/* Hero — total outstanding */}
        <div className="mb-8">
          <p className="text-sm text-text-secondary mb-1">Total Outstanding</p>
          <p className="text-5xl font-bold text-text-primary tracking-tight">
            {outstandingFormatted}
          </p>
          {hasMultiCurrency && (
            <p className="text-xs text-text-tertiary mt-1">
              Amounts shown as invoiced (no conversion applied).
            </p>
          )}
        </div>

        {/* StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Unpaid"
            value={unpaidCount.toString()}
            variant="default"
          >
            <FileText className="h-5 w-5 text-text-tertiary" />
          </StatCard>
          <StatCard
            label="Overdue"
            value={overdueCount.toString()}
            variant="warning"
          >
            <AlertCircle className="h-5 w-5 text-text-tertiary" />
          </StatCard>
          <StatCard
            label="Paid This Month"
            value={paidThisMonth.toString()}
            trend={paidTrend}
          >
            <CheckCircle className="h-5 w-5 text-text-tertiary" />
          </StatCard>
          {expenseAgg._count > 0 && (
            <StatCard
              label="Expenses This Month"
              value={formatCurrency(expenseAgg._sum.amount ?? 0, bp.baseCurrency)}
              variant="default"
              href="/expenses"
            >
              <Receipt className="h-5 w-5 text-text-tertiary" />
            </StatCard>
          )}
        </div>

        {/* Reconciliation summary */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:shadow-md">
            <p className="text-sm font-medium text-muted">Reconciled</p>
            <p className="mt-2 text-3xl font-bold text-[var(--success)]">{reconciledCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:shadow-md">
            <p className="text-sm font-medium text-muted">Discrepancies</p>
            <p className="mt-2 text-3xl font-bold text-[var(--warning)]">{discrepancyCount}</p>
          </div>
        </div>

        {(reconciledCount > 0 || discrepancyCount > 0) && (
          <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-muted">Payment Reconciliation</h2>
                <p className="mt-1 text-xs text-muted">
                  {reconciledCount} reconciled, {discrepancyCount} need{discrepancyCount === 1 ? "s" : ""} attention
                </p>
              </div>
              <Link
                href="/reconciliation"
                className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
              >
                View Details
              </Link>
            </div>
          </div>
        )}

        {/* Monthly invoice usage */}
        {tier.invoiceLimit !== null && (
          <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted">
                Monthly Invoice Usage ({tier.name})
              </h2>
              <span className="text-sm font-medium text-foreground">
                {monthlyInvoiceCount} / {tier.invoiceLimit}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 100
                    ? "bg-[var(--danger)]"
                    : usagePercent > 80
                    ? "bg-[var(--warning)]"
                    : "bg-[var(--success)]"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {usagePercent >= 100 && (
              <p className="mt-2 text-sm text-[var(--danger)]">
                Invoice limit reached.{" "}
                <Link href="/settings/billing" className="font-medium underline hover:text-foreground">
                  Upgrade your plan
                </Link>{" "}
                to create more invoices.
              </p>
            )}
          </div>
        )}

        {tier.invoiceLimit === null && (
          <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted">
                Monthly Invoice Usage ({tier.name})
              </h2>
              <span className="text-sm font-medium text-[var(--success)]">Unlimited</span>
            </div>
          </div>
        )}

        {/* Analytics widgets */}
        <div className="mb-8">
          <BenchmarkWidget
            benchmarks={benchmarkData}
            industry={user!.industry}
            hasEnoughData={hasEnoughBenchmarks}
          />
        </div>

        <div className="mb-8">
          <EfficiencyWidget metrics={efficiencyMetrics} plan={user!.plan} />
        </div>

        <div className="mb-8 max-w-sm">
          <PayYourselfWidget
            available={payYourself.available}
            baseCurrency={bp.baseCurrency}
            hasAccess={tier.features.includes("cash_flow_forecast")}
          />
        </div>

        <div className="mb-8">
          <ForecastWidget forecast={forecast} hasAccess={hasForecastAccess} />
        </div>

        {/* Recent invoices table */}
        {recentInvoices.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-primary mb-3">Recent Invoices</h2>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-text-primary">
                      {inv.invoiceNumber || inv.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{inv.clientName}</TableCell>
                    <TableCell>{formatCurrency(inv.amount, inv.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status as BadgeVariant}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell>{format(inv.dueDate, "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Quick Actions
          </h2>
          <p className="mb-4 text-sm text-muted">
            Manage your invoices and keep track of payments.
          </p>
          <div className="flex gap-3">
            <Button href="/invoices/new" size="sm">
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
            <Button href="/invoices" variant="secondary" size="sm">
              View All Invoices
            </Button>
          </div>
        </div>
      </DashboardClient>
    </PageShell>
  );
}

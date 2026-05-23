import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, differenceInCalendarDays, subDays } from "date-fns";
import DashboardClient from "./DashboardClient";
import { getTier } from "@/lib/subscriptions";
import Link from "next/link";
import BenchmarkWidget from "./BenchmarkWidget";
import { computeForecast } from "@/lib/forecast";
import ForecastWidget from "./ForecastWidget";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm transition hover:shadow-md">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const [unpaidCount, overdueCount, paidThisMonth, totalInvoices, monthlyInvoiceCount, reconciledCount, discrepancyCount] =
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

  const tier = getTier(user!.plan);
  const usagePercent = tier.invoiceLimit
    ? Math.min((monthlyInvoiceCount / tier.invoiceLimit) * 100, 100)
    : 0;

  if (totalInvoices === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
        <DashboardClient>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
            <p className="mb-4 text-sm text-muted">
              Get started by creating your first invoice.
            </p>
            <div className="flex gap-3">
              <a
                href="/invoices/new"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
              >
                New Invoice
              </a>
              <a
                href="/invoices"
                className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-surface-muted"
              >
                View All Invoices
              </a>
            </div>
          </div>
        </DashboardClient>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Invoices" value={totalInvoices} />
        <StatCard label="Unpaid" value={unpaidCount} />
        <StatCard label="Overdue" value={overdueCount} />
        <StatCard label="Paid This Month" value={paidThisMonth} />
      </div>

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

      <div className="mb-8">
        <BenchmarkWidget
          benchmarks={benchmarkData}
          industry={user!.industry}
          hasEnoughData={hasEnoughBenchmarks}
        />
      </div>

      <div className="mb-8">
        <ForecastWidget forecast={forecast} hasAccess={hasForecastAccess} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <p className="mb-4 text-sm text-muted">
          Manage your invoices and keep track of payments.
        </p>
        <div className="flex gap-3">
          <a
            href="/invoices/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
          >
            New Invoice
          </a>
          <a
            href="/invoices"
            className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-surface-muted"
          >
            View All Invoices
          </a>
        </div>
      </div>
    </div>
  );
}

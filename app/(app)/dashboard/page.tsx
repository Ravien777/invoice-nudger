import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth } from "date-fns";
import DashboardClient from "./DashboardClient";

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

  const [unpaidCount, overdueCount, paidThisMonth, totalInvoices] =
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
    ]);

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

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Invoices" value={totalInvoices} />
        <StatCard label="Unpaid" value={unpaidCount} />
        <StatCard label="Overdue" value={overdueCount} />
        <StatCard label="Paid This Month" value={paidThisMonth} />
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

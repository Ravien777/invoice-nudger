import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, startOfDay } from "date-fns";

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
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

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [unpaidCount, overdueCount, paidThisMonth, totalInvoices] =
    await Promise.all([
      prisma.invoice.count({
        where: { userId: user!.id, status: "unpaid" },
      }),
      prisma.invoice.count({
        where: {
          userId: user!.id,
          status: "unpaid",
          dueDate: { lt: today },
        },
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Invoices"
          value={totalInvoices}
          color="text-slate-900"
        />
        <StatCard
          label="Unpaid"
          value={unpaidCount}
          color="text-amber-600"
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          color="text-red-600"
        />
        <StatCard
          label="Paid This Month"
          value={paidThisMonth}
          color="text-green-600"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Quick Actions
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Manage your invoices and keep track of payments.
        </p>
        <div className="flex gap-3">
          <a
            href="/invoices/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            New Invoice
          </a>
          <a
            href="/invoices"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
          >
            View All Invoices
          </a>
        </div>
      </div>
    </div>
  );
}

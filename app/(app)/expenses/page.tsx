import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { PageShell } from "@/app/components/layout/PageShell";
import { seedDefaultExpenseCategories } from "@/lib/expense-categories";
import { assignReceiptEmail } from "@/lib/assign-receipt-emails";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  await seedDefaultExpenseCategories(user.id);

  let receiptEmail = user.receiptEmail;
  if (!receiptEmail) {
    receiptEmail = await assignReceiptEmail(user.id);
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [expenses, total, categories] = await Promise.all([
    prisma.expense.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "desc" },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    prisma.expense.count({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.expenseCategory.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = expenses.map((e) => ({
    ...e,
    date: format(e.date, "yyyy-MM-dd"),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  return (
    <PageShell
      title="Expenses"
      subtitle="Track what you spend so you know what you actually earned."
    >
      <ExpensesClient
        expenses={serialized}
        total={total}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        }))}
        currentMonth={format(now, "yyyy-MM")}
        receiptEmail={receiptEmail}
      />
    </PageShell>
  );
}

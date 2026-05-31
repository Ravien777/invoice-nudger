import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/layout/PageShell";
import BankClient from "./BankClient";

export default async function BankPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  const [connections, transactions] = await Promise.all([
    prisma.bankConnection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 200,
    }),
  ]);

  const invoiceIds = transactions.filter((t) => t.matchedInvoiceId).map((t) => t.matchedInvoiceId!);
  const expenseIds = transactions.filter((t) => t.matchedExpenseId).map((t) => t.matchedExpenseId!);
  const [invoices, expenses] = await Promise.all([
    invoiceIds.length > 0
      ? prisma.invoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, clientName: true, invoiceNumber: true },
        })
      : Promise.resolve([]),
    expenseIds.length > 0
      ? prisma.expense.findMany({
          where: { id: { in: expenseIds } },
          select: { id: true, description: true },
        })
      : Promise.resolve([]),
  ]);
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  const expenseMap = new Map(expenses.map((e) => [e.id, e]));

  return (
    <PageShell
      title="Bank Import"
      subtitle="Connect your bank to auto-import and match transactions."
    >
      <BankClient
        connections={connections.map((c) => ({
          id: c.id,
          provider: c.provider,
          institutionName: c.institutionName,
          accountMask: c.accountMask,
          status: c.status,
          lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        }))}
        initialTransactions={transactions.map((t) => {
          let matchedEntityName: string | null = null;
          let matchedEntityHref: string | null = null;
          if (t.matchedInvoiceId) {
            const inv = invoiceMap.get(t.matchedInvoiceId);
            matchedEntityName = inv ? (inv.invoiceNumber ?? inv.clientName) : t.matchedInvoiceId;
            matchedEntityHref = `/invoices/${t.matchedInvoiceId}`;
          } else if (t.matchedExpenseId) {
            const exp = expenseMap.get(t.matchedExpenseId);
            matchedEntityName = exp?.description ?? t.matchedExpenseId;
            matchedEntityHref = `/expenses`;
          }
          return {
            id: t.id,
            date: t.date.toISOString().split("T")[0],
            description: t.description,
            amount: t.amount,
            currency: t.currency,
            category: t.category,
            matchedInvoiceId: t.matchedInvoiceId,
            matchedExpenseId: t.matchedExpenseId,
            matchedEntityName,
            matchedEntityHref,
            status: t.status,
          };
        })}
      />
    </PageShell>
  );
}

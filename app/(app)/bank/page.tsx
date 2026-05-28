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
        initialTransactions={transactions.map((t) => ({
          id: t.id,
          date: t.date.toISOString().split("T")[0],
          description: t.description,
          amount: t.amount,
          currency: t.currency,
          category: t.category,
          matchedInvoiceId: t.matchedInvoiceId,
          matchedExpenseId: t.matchedExpenseId,
          status: t.status,
        }))}
      />
    </PageShell>
  );
}

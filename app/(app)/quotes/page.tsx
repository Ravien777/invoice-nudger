import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Quotes" };
import { PageShell } from "@/app/components/layout/PageShell";
import QuotesClient from "./QuotesClient";

export default async function QuotesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  const quotes = await prisma.quote.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  const serialized = quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    clientName: q.clientName,
    clientEmail: q.clientEmail,
    amount: q.amount,
    currency: q.currency,
    status: q.status,
    issueDate: format(q.issueDate, "yyyy-MM-dd"),
    expiryDate: q.expiryDate ? format(q.expiryDate, "yyyy-MM-dd") : null,
    convertedToInvoiceId: q.convertedToInvoiceId,
    createdAt: q.createdAt.toISOString(),
  }));

  return (
    <PageShell
      title="Quotes"
      subtitle="Price estimates you've sent. When a client agrees, turn it into an invoice in one click."
    >
      <QuotesClient quotes={serialized} />
    </PageShell>
  );
}

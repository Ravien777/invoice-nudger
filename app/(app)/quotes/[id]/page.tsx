import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { PageShell } from "@/app/components/layout/PageShell";
import QuoteDetailClient from "./QuoteDetailClient";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  const quote = await prisma.quote.findFirst({
    where: { id, userId: user.id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) notFound();

  const serialized = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientAddress: quote.clientAddress,
    amount: quote.amount,
    currency: quote.currency,
    status: quote.status,
    issueDate: format(quote.issueDate, "MMM d, yyyy"),
    expiryDate: quote.expiryDate ? format(quote.expiryDate, "MMM d, yyyy") : null,
    notes: quote.notes,
    sellerName: quote.sellerName,
    sellerAddress: quote.sellerAddress,
    sellerTaxId: quote.sellerTaxId,
    paymentTerms: quote.paymentTerms,
    subtotal: quote.subtotal,
    totalTax: quote.totalTax,
    convertedToInvoiceId: quote.convertedToInvoiceId,
    lineItems: quote.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      taxRate: li.taxRate,
      total: li.total,
    })),
  };

  return (
    <PageShell title={`Quote ${serialized.quoteNumber || ""}`} subtitle={`For ${serialized.clientName}`}>
      <QuoteDetailClient quote={serialized} />
    </PageShell>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { PageShell } from "@/app/components/layout/PageShell";
import QuoteForm from "@/app/components/QuoteForm";

export default async function EditQuotePage({
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
  if (quote.status !== "draft") redirect("/quotes");

  return (
    <PageShell title="Edit Quote" subtitle={`Editing ${quote.quoteNumber || quote.id.slice(0, 8)}`}>
      <QuoteForm
        mode="edit"
        quoteId={id}
        initialData={{
          clientName: quote.clientName,
          clientEmail: quote.clientEmail,
          clientAddress: quote.clientAddress ?? "",
          amount: quote.amount,
          currency: quote.currency,
          issueDate: format(quote.issueDate, "yyyy-MM-dd"),
          expiryDate: quote.expiryDate ? format(quote.expiryDate, "yyyy-MM-dd") : "",
          notes: quote.notes ?? "",
          sellerName: quote.sellerName ?? "",
          sellerAddress: quote.sellerAddress ?? "",
          sellerTaxId: quote.sellerTaxId ?? "",
          paymentTerms: quote.paymentTerms ?? "",
          subtotal: quote.subtotal ?? 0,
          totalTax: quote.totalTax ?? 0,
          lineItems: quote.lineItems.map((li) => ({
            id: li.id,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            taxRate: li.taxRate ?? 0,
          })),
        }}
      />
    </PageShell>
  );
}

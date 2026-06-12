import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import QuotePublicClient from "./QuotePublicClient";

export const dynamic = "force-dynamic";

export default async function QuotePublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { quoteId } = await params;
  const { token } = await searchParams;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) notFound();

  if (quote.status !== "sent") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Quote {quote.status === "accepted" ? "Accepted" : "No Longer Available"}</h1>
          <p className="text-gray-500 text-sm">
            {quote.status === "accepted"
              ? "This quote has already been accepted. The business will be in touch with your invoice."
              : quote.status === "declined"
              ? "This quote has been declined."
              : quote.status === "expired"
              ? "This quote has expired."
              : "This quote is not available for response."}
          </p>
        </div>
      </div>
    );
  }

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
    lineItems: quote.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      taxRate: li.taxRate,
      total: li.total,
    })),
  };

  return <QuotePublicClient quote={serialized} token={token} />;
}

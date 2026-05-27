"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Ban, FileText, Pencil } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format-currency";

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number | null;
  total: number;
}

interface QuoteData {
  id: string;
  quoteNumber: string | null;
  clientName: string;
  clientEmail: string;
  clientAddress: string | null;
  amount: number;
  currency: string;
  status: string;
  issueDate: string;
  expiryDate: string | null;
  notes: string | null;
  sellerName: string | null;
  sellerAddress: string | null;
  sellerTaxId: string | null;
  paymentTerms: string | null;
  subtotal: number | null;
  totalTax: number | null;
  convertedToInvoiceId: string | null;
  lineItems: QuoteLineItem[];
}

export default function QuoteDetailClient({ quote }: { quote: QuoteData }) {
  const router = useRouter();

  const handleConvert = async () => {
    const res = await fetch(`/api/quotes/${quote.id}/convert`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to convert");
      return;
    }
    const data = await res.json();
    toast.success("Quote converted to invoice");
    router.push(`/invoices/${data.invoiceId}/edit`);
  };

  const handleDecline = async () => {
    if (!confirm("Mark this quote as declined?")) return;
    const res = await fetch(`/api/quotes/${quote.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "declined" }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Quote declined");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-2">
        {quote.status === "draft" && (
          <>
            <Button href={`/quotes/${quote.id}/edit`} size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await fetch(`/api/quotes/${quote.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "sent" }),
                });
                toast.success("Quote marked as sent");
                router.refresh();
              }}
            >
              <ArrowRight className="h-4 w-4" />
              Mark Sent
            </Button>
          </>
        )}
        {quote.status === "sent" && (
          <>
            <Button size="sm" onClick={handleConvert}>
              <FileText className="h-4 w-4" />
              Convert to Invoice
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDecline}>
              <Ban className="h-4 w-4" />
              Mark Declined
            </Button>
          </>
        )}
        {quote.status === "accepted" && quote.convertedToInvoiceId && (
          <Button href={`/invoices/${quote.convertedToInvoiceId}/edit`} size="sm">
            <FileText className="h-4 w-4" />
            View Invoice
          </Button>
        )}
      </div>

      {/* Quote document preview */}
      <div className="max-w-2xl mx-auto rounded-xl border border-border-default bg-white p-8 shadow-sm text-gray-900">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wider">Quote</h1>
          <p className="text-gray-500 text-sm mt-1">{quote.sellerName || "Your Business"}</p>
          {quote.sellerAddress && <p className="text-gray-500 text-xs">{quote.sellerAddress}</p>}
          {quote.sellerTaxId && <p className="text-gray-500 text-xs">Tax ID: {quote.sellerTaxId}</p>}
        </div>

        <div className="flex justify-between mb-6 text-sm">
          <div>
            <p className="font-semibold text-gray-900">{quote.clientName}</p>
            <p className="text-gray-500">{quote.clientEmail}</p>
            {quote.clientAddress && <p className="text-gray-500">{quote.clientAddress}</p>}
          </div>
          <div className="text-right">
            <p><span className="text-gray-500">Quote #:</span> {quote.quoteNumber || "—"}</p>
            <p><span className="text-gray-500">Issue:</span> {quote.issueDate}</p>
            {quote.expiryDate && <p><span className="text-gray-500">Expires:</span> {quote.expiryDate}</p>}
            {quote.paymentTerms && <p><span className="text-gray-500">{quote.paymentTerms}</span></p>}
            <p className="mt-1">
              <Badge variant={quote.status as any}>{quote.status}</Badge>
            </p>
          </div>
        </div>

        {quote.lineItems.length > 0 && (
          <table className="w-full mb-6 text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                <th className="text-right py-2 text-gray-500 font-medium">Qty</th>
                <th className="text-right py-2 text-gray-500 font-medium">Price</th>
                <th className="text-right py-2 text-gray-500 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-gray-900">{item.description}</td>
                  <td className="py-2 text-right text-gray-700">{item.quantity}</td>
                  <td className="py-2 text-right text-gray-700">{formatCurrency(item.unitPrice, quote.currency)}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">{formatCurrency(item.total, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end mb-6">
          <div className="w-48 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCurrency(quote.subtotal ?? quote.amount, quote.currency)}</span>
            </div>
            {quote.totalTax ? (
              <div className="flex justify-between">
                <span className="text-gray-500">Tax</span>
                <span className="text-gray-900">{formatCurrency(quote.totalTax, quote.currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-gray-300 pt-1 font-bold text-base">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">{formatCurrency(quote.amount, quote.currency)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {quote.expiryDate && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              This quote expires on {quote.expiryDate}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

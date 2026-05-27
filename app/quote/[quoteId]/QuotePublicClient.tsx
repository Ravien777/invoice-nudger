"use client";

import { useState } from "react";
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
  lineItems: QuoteLineItem[];
}

export default function QuotePublicClient({ quote }: { quote: QuoteData }) {
  const [actioned, setActioned] = useState(false);

  const handleAction = async (action: "accepted" | "declined") => {
    const res = await fetch(`/api/quotes/${quote.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to process response");
      return;
    }
    setActioned(true);
  };

  if (actioned) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Thank You</h1>
          <p className="text-gray-500 text-sm">
            You&apos;ve responded to this quote. {quote.sellerName || "The business"} will be notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Quote document */}
        <div className="bg-white rounded-2xl border shadow-sm p-8 mb-6 text-gray-900">
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
            </div>
            <div className="text-right">
              <p><span className="text-gray-500">Quote #:</span> {quote.quoteNumber || "—"}</p>
              <p><span className="text-gray-500">Issue:</span> {quote.issueDate}</p>
              {quote.expiryDate && <p><span className="text-gray-500">Expires:</span> {quote.expiryDate}</p>}
            </div>
          </div>

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

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => handleAction("accepted")}
            className="px-8 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors shadow-sm"
          >
            Accept Quote
          </button>
          <button
            onClick={() => handleAction("declined")}
            className="px-8 py-3 bg-white text-gray-700 rounded-xl font-medium border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import toast from "react-hot-toast";
import { formatCurrency, currencySymbol, currenciesWithSymbol } from "@/lib/format-currency";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface QuoteFormProps {
  initialData?: {
    clientName: string;
    clientEmail: string;
    clientAddress: string;
    amount: number;
    currency: string;
    issueDate: string;
    expiryDate: string;
    notes: string;
    sellerName: string;
    sellerAddress: string;
    sellerTaxId: string;
    paymentTerms: string;
    subtotal: number;
    totalTax: number;
    lineItems: LineItem[];
  };
  mode: "create" | "edit";
  quoteId?: string;
}

let itemCounter = 0;
function newItem(): LineItem {
  itemCounter += 1;
  return { id: `item_${itemCounter}`, description: "", quantity: 1, unitPrice: 0, taxRate: 0 };
}

export default function QuoteForm({ initialData, mode, quoteId }: QuoteFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [clientName, setClientName] = useState(initialData?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail ?? "");
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress ?? "");
  const [currency, setCurrency] = useState(initialData?.currency ?? "USD");
  const [issueDate, setIssueDate] = useState(initialData?.issueDate ?? today);
  const [expiryDate, setExpiryDate] = useState(initialData?.expiryDate ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [sellerName, setSellerName] = useState(initialData?.sellerName ?? "");
  const [sellerAddress, setSellerAddress] = useState(initialData?.sellerAddress ?? "");
  const [sellerTaxId, setSellerTaxId] = useState(initialData?.sellerTaxId ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initialData?.paymentTerms ?? "");
  const [lineItems, setLineItems] = useState<LineItem[]>(initialData?.lineItems ?? [newItem()]);
  const [submitting, setSubmitting] = useState(false);

  const computedSubtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [lineItems],
  );

  const computedTax = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100), 0),
    [lineItems],
  );

  const computedTotal = computedSubtotal + computedTax;

  const addItem = () => setLineItems((prev) => [...prev, newItem()]);
  const removeItem = (id: string) => setLineItems((prev) => prev.filter((i) => i.id !== id));
  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setLineItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      clientName,
      clientEmail,
      clientAddress: clientAddress || undefined,
      currency,
      issueDate,
      expiryDate: expiryDate || undefined,
      notes: notes || undefined,
      sellerName: sellerName || undefined,
      sellerAddress: sellerAddress || undefined,
      sellerTaxId: sellerTaxId || undefined,
      paymentTerms: paymentTerms || undefined,
      amount: computedTotal,
      subtotal: computedSubtotal,
      totalTax: computedTax,
      lineItems: lineItems.map((item, i) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || undefined,
        total: item.quantity * item.unitPrice * (1 + (item.taxRate || 0) / 100),
        sortOrder: i,
      })),
    };

    try {
      const url = mode === "create" ? "/api/quotes" : `/api/quotes/${quoteId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = Object.values(err.error || {}).flat().join(", ") || "Failed to save quote";
        toast.error(msg);
        return;
      }

      toast.success(mode === "create" ? "Quote created" : "Quote updated");
      router.push("/quotes");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Form fields */}
        <div className="space-y-6">
          {/* Client section */}
          <div className="rounded-xl border border-border-default bg-surface p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Client Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Client Name *</label>
                <input
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Client Email *</label>
                <input
                  required
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Client Address</label>
              <textarea
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary resize-none"
              />
            </div>
          </div>

          {/* Quote details */}
          <div className="rounded-xl border border-border-default bg-surface p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Quote Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Issue Date *</label>
                <input
                  required
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                >
                  {currenciesWithSymbol().map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Payment Terms</label>
                <input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                  placeholder="e.g. Net 30"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Seller Name</label>
                <input
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Seller Address</label>
              <textarea
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Tax ID / VAT Number</label>
                <input
                  value={sellerTaxId}
                  onChange={(e) => setSellerTaxId(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-border-default bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Line Items</h3>
              <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={item.id} className="flex items-start gap-2 p-3 rounded-lg bg-surface-secondary">
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        className="w-full rounded border border-border-default bg-surface px-2 py-1.5 text-sm text-text-primary"
                        placeholder="Description"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 1)}
                        className="w-full rounded border border-border-default bg-surface px-2 py-1.5 text-sm text-text-primary text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">{currencySymbol(currency)}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value) || 0)}
                          className="w-full rounded border border-border-default bg-surface pl-5 pr-2 py-1.5 text-sm text-text-primary text-right"
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.taxRate}
                        onChange={(e) => updateItem(item.id, "taxRate", Number(e.target.value) || 0)}
                        className="w-full rounded border border-border-default bg-surface px-2 py-1.5 text-sm text-text-primary text-right"
                        placeholder="Tax %"
                      />
                    </div>
                    <div className="col-span-1 flex items-center pt-1.5 text-sm text-text-secondary font-medium text-right">
                      {formatCurrency(item.quantity * item.unitPrice * (1 + item.taxRate / 100), currency)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1 mt-1 text-text-tertiary hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border-default pt-3 space-y-1 text-right">
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-text-primary font-medium w-24 text-right">{formatCurrency(computedSubtotal, currency)}</span>
              </div>
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-text-secondary">Tax</span>
                <span className="text-text-primary w-24 text-right">{formatCurrency(computedTax, currency)}</span>
              </div>
              <div className="flex justify-end gap-8 text-base font-semibold border-t border-border-default pt-1">
                <span className="text-text-primary">Total</span>
                <span className="text-text-primary w-24 text-right">{formatCurrency(computedTotal, currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border-default bg-surface p-5">
            <label className="block text-xs text-text-secondary mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary resize-none"
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-xs text-text-tertiary mb-2 uppercase tracking-wider">Preview</p>
            <div className="rounded-xl border border-border-default bg-white p-6 shadow-sm text-gray-900 text-xs leading-relaxed">
              <div className="text-center mb-4">
                <h1 className="text-lg font-bold uppercase tracking-wider">Quote</h1>
                <p className="text-gray-500 text-xs mt-0.5">{sellerName || "Your Business Name"}</p>
                {sellerAddress && <p className="text-gray-500 text-xs">{sellerAddress}</p>}
                {sellerTaxId && <p className="text-gray-500 text-xs">Tax ID: {sellerTaxId}</p>}
              </div>

              <div className="flex justify-between mb-4 text-xs">
                <div>
                  <p className="font-semibold text-gray-900">{clientName}</p>
                  <p className="text-gray-500">{clientEmail}</p>
                  {clientAddress && <p className="text-gray-500">{clientAddress}</p>}
                </div>
                <div className="text-right">
                  <p><span className="text-gray-500">Issue:</span> {issueDate}</p>
                  {expiryDate && <p><span className="text-gray-500">Expires:</span> {expiryDate}</p>}
                  {paymentTerms && <p><span className="text-gray-500">{paymentTerms}</span></p>}
                </div>
              </div>

              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1.5 text-gray-500 font-medium">Description</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Qty</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Price</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, i) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-900">{item.description || "—"}</td>
                      <td className="py-1.5 text-right text-gray-700">{item.quantity}</td>
                      <td className="py-1.5 text-right text-gray-700">{formatCurrency(item.unitPrice, currency)}</td>
                      <td className="py-1.5 text-right text-gray-900">{formatCurrency(item.quantity * item.unitPrice, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-40 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900 font-medium">{formatCurrency(computedSubtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax</span>
                    <span className="text-gray-900">{formatCurrency(computedTax, currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-0.5 font-bold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{formatCurrency(computedTotal, currency)}</span>
                  </div>
                </div>
              </div>

              {notes && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-gray-500 text-xs whitespace-pre-wrap">{notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" type="button" onClick={() => router.push("/quotes")}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === "create" ? "Create Quote" : "Update Quote"}
        </Button>
      </div>
    </form>
  );
}

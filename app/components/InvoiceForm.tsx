"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { invoiceSchema, InvoiceFormData } from "@/lib/validations";
import toast from "react-hot-toast";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";
import { InvoiceTemplate } from "@/app/components/InvoiceTemplate";
import { Plus, Trash2, FileText } from "lucide-react";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface Schedule {
  id: string;
  name: string;
  isDefault: boolean;
}

interface InvoiceFormProps {
  initialData?: {
    id: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string | null;
    projectName: string | null;
    amount: number;
    currency: string;
    dueDate: string;
    invoiceNumber: string | null;
    notes: string | null;
    reminderScheduleId: string | null;
    promisedDate: string | null;
    promiseStatus: string | null;
  };
  mode: "create" | "edit";
  schedules: Schedule[];
}

function formatDateForInput(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function InvoiceForm({
  initialData,
  mode,
  schedules,
}: InvoiceFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [formData, setFormData] = useState<InvoiceFormData>({
    clientName: initialData?.clientName ?? "",
    clientEmail: initialData?.clientEmail ?? "",
    clientPhone: initialData?.clientPhone ?? "",
    projectName: initialData?.projectName ?? "",
    amount: initialData?.amount ?? 0,
    currency: initialData?.currency ?? "USD",
    dueDate: initialData?.dueDate
      ? formatDateForInput(initialData.dueDate)
      : "",
    invoiceNumber: initialData?.invoiceNumber ?? "",
    notes: initialData?.notes ?? "",
    reminderScheduleId: initialData?.reminderScheduleId ?? "",
  });

  const [promisedDate, setPromisedDate] = useState(
    initialData?.promisedDate
      ? formatDateForInput(initialData.promisedDate)
      : "",
  );
  const [promiseStatus, setPromiseStatus] = useState(
    initialData?.promiseStatus ?? "none",
  );

  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeAmount, setLateFeeAmount] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [feeCap, setFeeCap] = useState(0);
  const [accruedFees, setAccruedFees] = useState(0);
  const [lateFeeLoaded, setLateFeeLoaded] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountFixed, setDiscountFixed] = useState(0);

  const computedSubtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const computedItemTax = lineItems.reduce(
    (sum, item) =>
      sum + (item.quantity * item.unitPrice * item.taxRate) / 100,
    0,
  );
  const computedDiscount =
    discountFixed > 0
      ? discountFixed
      : (computedSubtotal * discountPercent) / 100;
  const computedTotal = computedSubtotal + computedItemTax - computedDiscount;
  const hasLineItems = lineItems.length > 0;

  useEffect(() => {
    if (mode === "edit" && initialData && !lateFeeLoaded) {
      fetch(`/api/invoices/${initialData.id}`)
        .then((res) => res.json())
        .then((data) => {
          setLateFeeEnabled(data.lateFeeEnabled ?? false);
          setLateFeeAmount(data.lateFeeAmount ?? 0);
          setInterestRate(data.interestRate ?? 0);
          setFeeCap(data.feeCap ?? 0);
          setAccruedFees(data.accruedFees ?? 0);
          setLateFeeLoaded(true);
        })
        .catch(() => {});
    }
  }, [mode, initialData, lateFeeLoaded]);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
      },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateLineItem(
    id: string,
    field: keyof LineItem,
    value: string | number,
  ) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  const previewInvoice = useMemo(
    () => ({
      invoiceNumber: formData.invoiceNumber || null,
      clientName: formData.clientName,
      clientEmail: formData.clientEmail,
      clientAddress: null,
      amount: hasLineItems ? computedTotal : formData.amount,
      subtotal: hasLineItems ? computedSubtotal : formData.amount,
      totalTax: hasLineItems ? computedItemTax : 0,
      currency: formData.currency,
      dueDate: formData.dueDate,
      issueDate: new Date().toISOString(),
      status: "draft" as const,
      notes: formData.notes || null,
      lineItems: hasLineItems
        ? lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          }))
        : undefined,
      paymentLink: null,
    }),
    [
      formData,
      lineItems,
      computedTotal,
      computedSubtotal,
      computedItemTax,
      hasLineItems,
    ],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const submitAmount = hasLineItems ? computedTotal : formData.amount;
    const submitData = { ...formData, amount: submitAmount };

    const validation = invoiceSchema.safeParse(submitData);
    if (!validation.success) {
      setErrors(validation.error.flatten().fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      const url =
        mode === "create"
          ? "/api/invoices"
          : `/api/invoices/${initialData!.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const body =
        mode === "edit"
          ? {
              ...submitData,
              lateFeeEnabled,
              lateFeeAmount,
              interestRate,
              feeCap,
            }
          : submitData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.fieldErrors) {
          setErrors(data.error.fieldErrors);
        } else {
          toast.error(data.error || "Something went wrong");
        }
        return;
      }

      toast.success(
        mode === "create" ? "Invoice created" : "Invoice updated",
      );
      router.push("/invoices");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function label(text: string) {
    return (
      <label className="block text-sm font-medium text-text-secondary mb-1">
        {text}
      </label>
    );
  }

  function fieldError(name: string) {
    if (!errors[name]) return null;
    return <p className="mt-1 text-xs text-danger">{errors[name][0]}</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        {/* Left column — form fields */}
        <div className="space-y-6">
          {/* Invoice Number */}
          <div>
            {label("Invoice Number (optional)")}
            <Input
              id="invoiceNumber"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleChange}
            />
            {fieldError("invoiceNumber")}
          </div>

          {/* Client Name + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {label("Client Name")}
              <Input
                id="clientName"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                required
              />
              {fieldError("clientName")}
            </div>
            <div>
              {label("Client Phone (optional)")}
              <Input
                id="clientPhone"
                name="clientPhone"
                value={formData.clientPhone}
                onChange={handleChange}
                placeholder="+12025551234"
              />
              {fieldError("clientPhone")}
              <p className="mt-1 text-xs text-text-tertiary">
                Required for SMS/WhatsApp reminders. Use E.164 format (e.g.
                +12025551234).
              </p>
            </div>
          </div>

          {/* Client Email + Project Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {label("Client Email")}
              <Input
                id="clientEmail"
                name="clientEmail"
                type="email"
                value={formData.clientEmail}
                onChange={handleChange}
                required
              />
              {fieldError("clientEmail")}
            </div>
            <div>
              {label("Project Name (optional)")}
              <Input
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleChange}
                placeholder="e.g. Website Redesign"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Used to personalize AI-generated reminder emails.
              </p>
            </div>
          </div>

          {/* Currency + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {label("Currency")}
              <Select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
            <div>
              {label("Due Date")}
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={handleChange}
                required
              />
              {fieldError("dueDate")}
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-lg border border-border-default bg-surface-secondary p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">
                Line Items
              </h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={addLineItem}
              >
                Add Item
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <FileText className="h-8 w-8 text-text-tertiary mb-2" />
                <p className="text-sm text-text-secondary">
                  No line items yet. Click &quot;Add Item&quot; to itemize the
                  invoice.
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  Without line items, the total amount can be entered directly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 p-3 rounded-md bg-surface-primary border border-border-default"
                  >
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(
                            item.id,
                            "description",
                            e.target.value,
                          )
                        }
                        className="mb-2"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity || ""}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "quantity",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          min="0"
                          step="1"
                          className="w-20"
                        />
                        <Input
                          type="number"
                          placeholder="Unit price"
                          value={item.unitPrice || ""}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "unitPrice",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          min="0"
                          step="0.01"
                          className="w-28"
                        />
                        <Input
                          type="number"
                          placeholder="Tax %"
                          value={item.taxRate || ""}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "taxRate",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-20"
                        />
                        <div className="flex items-center justify-end w-24 text-sm font-medium text-text-primary pt-2 shrink-0">
                          {formatCurrency(
                            item.quantity * item.unitPrice,
                            formData.currency,
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => removeLineItem(item.id)}
                      aria-label="Remove line item"
                      className="text-danger hover:text-danger mt-1 shrink-0"
                    />
                  </div>
                ))}

                {/* Totals summary */}
                <div className="border-t border-border-default pt-3 space-y-1">
                  <div className="flex justify-between text-sm text-text-secondary">
                    <span>Subtotal</span>
                    <span>{formatCurrency(computedSubtotal, formData.currency)}</span>
                  </div>
                  {computedItemTax > 0 && (
                    <div className="flex justify-between text-sm text-text-secondary">
                      <span>Tax</span>
                      <span>{formatCurrency(computedItemTax, formData.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-medium text-text-primary">
                    <span>Total</span>
                    <span>{formatCurrency(computedTotal, formData.currency)}</span>
                  </div>
                </div>

                {/* Discount */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border-default">
                  <div>
                    {label("Discount (%)")}
                    <Input
                      type="number"
                      value={discountPercent || ""}
                      onChange={(e) => {
                        setDiscountPercent(parseFloat(e.target.value) || 0);
                        if (parseFloat(e.target.value) > 0)
                          setDiscountFixed(0);
                      }}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div>
                    {label("Discount (fixed)")}
                    <Input
                      type="number"
                      value={discountFixed || ""}
                      onChange={(e) => {
                        setDiscountFixed(parseFloat(e.target.value) || 0);
                        if (parseFloat(e.target.value) > 0)
                          setDiscountPercent(0);
                      }}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    {label("Discount amount")}
                    <div className="mt-1.5 text-sm font-medium text-text-primary pt-1">
                      -{formatCurrency(computedDiscount, formData.currency)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Amount (shown when no line items) */}
          {!hasLineItems && (
            <div>
              {label("Total Amount")}
              <Input
                id="amount"
                name="amount"
                type="number"
                value={formData.amount || ""}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
                prefix={formData.currency}
              />
              {fieldError("amount")}
            </div>
          )}

          {/* Notes */}
          <div>
            {label("Notes (optional)")}
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full bg-surface-tertiary border border-border-default rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors resize-none"
            />
            {fieldError("notes")}
          </div>

          {/* Reminder Schedule */}
          {schedules.length > 0 && (
            <div>
              {label("Reminder Schedule")}
              <Select
                id="reminderScheduleId"
                name="reminderScheduleId"
                value={formData.reminderScheduleId}
                onChange={handleChange}
              >
                <option value="">Default schedule</option>
                {schedules
                  .filter((s) => !s.isDefault)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
              <p className="mt-1 text-xs text-text-tertiary">
                Leave as &quot;Default schedule&quot; to use your standard
                reminder settings.
              </p>
            </div>
          )}

          {/* Late Fees (edit mode) */}
          {mode === "edit" && (
            <div className="rounded-lg border border-border-default bg-surface-secondary p-4">
              <h3 className="mb-3 text-sm font-medium text-text-primary">
                Late Fees & Interest
              </h3>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-text-secondary">
                    Enable Late Fees
                  </label>
                  <button
                    type="button"
                    onClick={() => setLateFeeEnabled(!lateFeeEnabled)}
                    className={`relative h-6 w-11 rounded-full transition ${
                      lateFeeEnabled ? "bg-accent" : "bg-surface-tertiary"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        lateFeeEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {lateFeeEnabled && (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Late Fee Amount
                      </label>
                      <Input
                        type="number"
                        value={lateFeeAmount || ""}
                        onChange={(e) =>
                          setLateFeeAmount(parseFloat(e.target.value) || 0)
                        }
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Daily Interest Rate (%)
                      </label>
                      <Input
                        type="number"
                        value={interestRate || ""}
                        onChange={(e) =>
                          setInterestRate(parseFloat(e.target.value) || 0)
                        }
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-text-secondary mb-1">
                      Fee Cap ($)
                    </label>
                    <Input
                      type="number"
                      value={feeCap || ""}
                      onChange={(e) =>
                        setFeeCap(parseFloat(e.target.value) || 0)
                      }
                      step="0.01"
                      min="0"
                      className="max-w-xs"
                    />
                  </div>
                  {accruedFees > 0 && (
                    <div className="rounded-lg bg-warning/10 p-2 text-xs text-warning">
                      Fees accrued so far:{" "}
                      {formatCurrency(accruedFees, formData.currency)}
                      <br />
                      Total balance:{" "}
                      {formatCurrency(
                        accruedFees + (initialData?.amount || 0),
                        formData.currency,
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Promise Detection (edit mode) */}
          {mode === "edit" && (
            <div className="rounded-lg border border-border-default bg-surface-secondary p-4">
              <h3 className="mb-3 text-sm font-medium text-text-primary">
                Promise Detection
              </h3>

              <div className="mb-4">
                {label("Promised Date (manual override)")}
                <Input
                  id="promisedDate"
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  Set a date to pause reminders until. Leave empty to clear.
                </p>
              </div>

              <div>
                {label("Status")}
                <Select
                  value={promiseStatus}
                  onChange={(e) => setPromiseStatus(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="active">Active</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="expired">Expired</option>
                  <option value="overridden">Overridden</option>
                  <option value="fulfilled">Fulfilled</option>
                </Select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
            >
              {submitting
                ? "Saving..."
                : mode === "create"
                  ? "Create Invoice"
                  : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/invoices")}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Right column — live preview (hidden on mobile) */}
        <div className="hidden lg:block lg:sticky lg:top-8 self-start">
          <div className="bg-white rounded-xl border border-border-default shadow-lg overflow-hidden">
            <div className="bg-surface-tertiary px-4 py-2 border-b border-border-default">
              <span className="text-xs font-medium text-text-secondary">
                LIVE PREVIEW
              </span>
            </div>
            <div className="overflow-hidden">
              <div
                className="origin-top-left"
                style={{
                  transform: "scale(0.65)",
                  width: "153.846%",
                }}
              >
                <InvoiceTemplate invoice={previewInvoice} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

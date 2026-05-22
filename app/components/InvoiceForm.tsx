"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { invoiceSchema, InvoiceFormData } from "@/lib/validations";
import toast from "react-hot-toast";

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

  const [promisedDate, setPromisedDate] = useState(initialData?.promisedDate ? formatDateForInput(initialData.promisedDate) : "");
  const [promiseStatus, setPromiseStatus] = useState(initialData?.promiseStatus ?? "none");

  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeAmount, setLateFeeAmount] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [feeCap, setFeeCap] = useState(0);
  const [accruedFees, setAccruedFees] = useState(0);
  const [lateFeeLoaded, setLateFeeLoaded] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const validation = invoiceSchema.safeParse(formData);
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

      const body = mode === "edit" ? {
        ...formData,
        lateFeeEnabled,
        lateFeeAmount,
        interestRate,
        feeCap,
      } : formData;

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

      toast.success(mode === "create" ? "Invoice created" : "Invoice updated");
      router.push("/invoices");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <label
          htmlFor="invoiceNumber"
          className="block text-sm font-medium text-muted"
        >
          Invoice Number (optional)
        </label>
        <input
          type="text"
          id="invoiceNumber"
          name="invoiceNumber"
          value={formData.invoiceNumber}
          onChange={handleChange}
          className={inputClass}
        />
        {errors.invoiceNumber && (
          <p className="mt-1 text-xs text-[var(--danger)]">
            {errors.invoiceNumber[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="clientName"
          className="block text-sm font-medium text-muted"
        >
          Client Name
        </label>
        <input
          type="text"
          id="clientName"
          name="clientName"
          value={formData.clientName}
          onChange={handleChange}
          required
          className={inputClass}
        />
        {errors.clientName && (
          <p className="mt-1 text-xs text-[var(--danger)]">
            {errors.clientName[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="clientPhone"
          className="block text-sm font-medium text-muted"
        >
          Client Phone (optional)
        </label>
        <input
          type="tel"
          id="clientPhone"
          name="clientPhone"
          value={formData.clientPhone}
          onChange={handleChange}
          placeholder="+12025551234"
          className={inputClass}
        />
        {errors.clientPhone && (
          <p className="mt-1 text-xs text-[var(--danger)]">
            {errors.clientPhone[0]}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Required for SMS/WhatsApp reminders. Use E.164 format (e.g. +12025551234).
        </p>
      </div>

      <div>
        <label
          htmlFor="clientEmail"
          className="block text-sm font-medium text-muted"
        >
          Client Email
        </label>
        <input
          type="email"
          id="clientEmail"
          name="clientEmail"
          value={formData.clientEmail}
          onChange={handleChange}
          required
          className={inputClass}
        />
        {errors.clientEmail && (
          <p className="mt-1 text-xs text-[var(--danger)]">
            {errors.clientEmail[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="projectName"
          className="block text-sm font-medium text-muted"
        >
          Project Name (optional)
        </label>
        <input
          type="text"
          id="projectName"
          name="projectName"
          value={formData.projectName}
          onChange={handleChange}
          className={inputClass}
          placeholder="e.g. Website Redesign"
        />
        <p className="mt-1 text-xs text-muted">
          Used to personalize AI-generated reminder emails.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-muted"
          >
            Amount
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount || ""}
            onChange={handleChange}
            step="0.01"
            min="0"
            required
            className={inputClass}
          />
          {errors.amount && (
            <p className="mt-1 text-xs text-[var(--danger)]">
              {errors.amount[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="currency"
            className="block text-sm font-medium text-muted"
          >
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="dueDate"
          className="block text-sm font-medium text-muted"
        >
          Due Date
        </label>
        <input
          type="date"
          id="dueDate"
          name="dueDate"
          value={formData.dueDate}
          onChange={handleChange}
          required
          className={inputClass}
        />
        {errors.dueDate && (
          <p className="mt-1 text-xs text-[var(--danger)]">
            {errors.dueDate[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-muted">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className={inputClass}
        />
        {errors.notes && (
          <p className="mt-1 text-xs text-[var(--danger)]">{errors.notes[0]}</p>
        )}
      </div>

      {schedules.length > 0 && (
        <div>
          <label
            htmlFor="reminderScheduleId"
            className="block text-sm font-medium text-muted"
          >
            Reminder Schedule
          </label>
          <select
            id="reminderScheduleId"
            name="reminderScheduleId"
            value={formData.reminderScheduleId}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Default schedule</option>
            {schedules
              .filter((s) => !s.isDefault)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Leave as &quot;Default schedule&quot; to use your standard reminder
            settings.
          </p>
        </div>
      )}

      {mode === "edit" && (
        <div className="rounded-lg border border-border bg-surface-muted p-4">
          <h3 className="mb-3 text-sm font-medium text-muted">Late Fees & Interest</h3>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-muted">Enable Late Fees</label>
              <button
                onClick={() => setLateFeeEnabled(!lateFeeEnabled)}
                className={`relative h-6 w-11 rounded-full transition ${
                  lateFeeEnabled ? "bg-accent" : "bg-surface-muted"
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
                  <label className="block text-xs text-muted">Late Fee Amount</label>
                  <input
                    type="number"
                    value={lateFeeAmount || ""}
                    onChange={(e) => setLateFeeAmount(parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    className="mt-0.5 block w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted">Daily Interest Rate (%)</label>
                  <input
                    type="number"
                    value={interestRate || ""}
                    onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    className="mt-0.5 block w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-muted">Fee Cap ($)</label>
                <input
                  type="number"
                  value={feeCap || ""}
                  onChange={(e) => setFeeCap(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  className="mt-0.5 block w-full max-w-xs rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              {accruedFees > 0 && (
                <div className="rounded-lg bg-[var(--warning-muted)] p-2 text-xs text-[var(--warning)]">
                  Fees accrued so far: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(accruedFees)}
                  <br />
                  Total balance: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(accruedFees + (initialData?.amount || 0))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="rounded-lg border border-border bg-surface-muted p-4">
          <h3 className="mb-3 text-sm font-medium text-muted">Promise Detection</h3>

          <div className="mb-4">
            <label
              htmlFor="promisedDate"
              className="block text-sm font-medium text-muted"
            >
              Promised Date (manual override)
            </label>
            <input
              type="date"
              id="promisedDate"
              value={promisedDate}
              onChange={(e) => setPromisedDate(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted">
              Set a date to pause reminders until. Leave empty to clear.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted">Status</label>
            <select
              value={promiseStatus}
              onChange={(e) => setPromiseStatus(e.target.value)}
              className={inputClass}
            >
              <option value="none">None</option>
              <option value="active">Active</option>
              <option value="pending_review">Pending Review</option>
              <option value="expired">Expired</option>
              <option value="overridden">Overridden</option>
              <option value="fulfilled">Fulfilled</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting
            ? "Saving..."
            : mode === "create"
              ? "Create Invoice"
              : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/invoices")}
          className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-surface-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
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
    amount: number;
    currency: string;
    dueDate: string;
    invoiceNumber: string | null;
    notes: string | null;
    reminderScheduleId: string | null;
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

export default function InvoiceForm({ initialData, mode, schedules }: InvoiceFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [formData, setFormData] = useState<InvoiceFormData>({
    clientName: initialData?.clientName ?? "",
    clientEmail: initialData?.clientEmail ?? "",
    amount: initialData?.amount ?? 0,
    currency: initialData?.currency ?? "USD",
    dueDate: initialData?.dueDate
      ? formatDateForInput(initialData.dueDate)
      : "",
    invoiceNumber: initialData?.invoiceNumber ?? "",
    notes: initialData?.notes ?? "",
    reminderScheduleId: initialData?.reminderScheduleId ?? "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
        mode === "create" ? "Invoice created" : "Invoice updated"
      );
      router.push("/invoices");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <label
          htmlFor="invoiceNumber"
          className="block text-sm font-medium text-slate-700"
        >
          Invoice Number (optional)
        </label>
        <input
          type="text"
          id="invoiceNumber"
          name="invoiceNumber"
          value={formData.invoiceNumber}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.invoiceNumber && (
          <p className="mt-1 text-xs text-red-600">
            {errors.invoiceNumber[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="clientName"
          className="block text-sm font-medium text-slate-700"
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
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.clientName && (
          <p className="mt-1 text-xs text-red-600">{errors.clientName[0]}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="clientEmail"
          className="block text-sm font-medium text-slate-700"
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
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.clientEmail && (
          <p className="mt-1 text-xs text-red-600">{errors.clientEmail[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-slate-700"
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
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.amount && (
            <p className="mt-1 text-xs text-red-600">{errors.amount[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="currency"
            className="block text-sm font-medium text-slate-700"
          >
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="block text-sm font-medium text-slate-700"
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
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.dueDate && (
          <p className="mt-1 text-xs text-red-600">{errors.dueDate[0]}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-slate-700"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.notes && (
          <p className="mt-1 text-xs text-red-600">{errors.notes[0]}</p>
        )}
      </div>

      {schedules.length > 0 && (
        <div>
          <label
            htmlFor="reminderScheduleId"
            className="block text-sm font-medium text-slate-700"
          >
            Reminder Schedule
          </label>
          <select
            id="reminderScheduleId"
            name="reminderScheduleId"
            value={formData.reminderScheduleId}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <p className="mt-1 text-xs text-slate-500">
            Leave as &quot;Default schedule&quot; to use your standard reminder settings.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
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
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import InvoiceTable from "@/app/components/InvoiceTable";
import CSVUploadModal from "@/app/components/CSVUploadModal";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleStep {
  emailTemplate: string;
  daysOffset: number;
}

interface InvoicesClientProps {
  initialInvoices: Invoice[];
  scheduleSteps: ScheduleStep[];
}

const FILTERS = ["all", "unpaid", "overdue", "paid", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];

export default function InvoicesClient({
  initialInvoices,
  scheduleSteps,
}: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const handleMarkPaid = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/mark-paid`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error };
      }

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: "paid" } : inv)),
      );
      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        return { success: false };
      }
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      return { success: true };
    } catch {
      return { success: false };
    }
  }, []);

  const filtered =
    filter === "all"
      ? invoices
      : invoices.filter((inv) => inv.status === filter);
  const counts = FILTERS.reduce(
    (acc, f) => {
      acc[f] =
        f === "all"
          ? invoices.length
          : invoices.filter((inv) => inv.status === f).length;
      return acc;
    },
    {} as Record<Filter, number>,
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCsvModalOpen(true)}
            className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-surface-muted"
          >
            Upload CSV
          </button>
          <Link
            href="/invoices/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110"
          >
            New Invoice
          </Link>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === f
                ? "bg-accent text-surface"
                : "bg-surface text-foreground ring-1 ring-border hover:bg-surface-muted"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      <InvoiceTable
        invoices={filtered}
        onUploadCsv={() => setCsvModalOpen(true)}
        scheduleSteps={scheduleSteps}
        onMarkPaid={handleMarkPaid}
        onDelete={handleDelete}
      />
      <CSVUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onUploadComplete={refetch}
      />
    </div>
  );
}

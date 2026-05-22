"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import InvoiceTable from "@/app/components/InvoiceTable";
import CSVUploadModal from "@/app/components/CSVUploadModal";
import AIReminderModal from "./components/AIReminderModal";
import PortalTokenModal from "./components/PortalTokenModal";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  projectName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  notes: string | null;
  source: string | null;
  paymentLink: string | null;
  paidAt: string | null;
  reconciliationStatus: string | null;
  promiseStatus: string | null;
  promisedDate: string | null;
  promiseConfidence: number | null;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  interestRate: number;
  accruedFees: number;
  feeCap: number;
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
  userTone?: string;
}

const FILTERS = ["all", "unpaid", "overdue", "paid", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];

export default function InvoicesClient({
  initialInvoices,
  scheduleSteps,
  userTone = "professional",
}: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [portalModalOpen, setPortalModalOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [aiModal, setAiModal] = useState<{
    open: boolean;
    invoiceId: string;
    stepName: string;
  } | null>(null);

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

  const handleGenerateAI = useCallback((id: string) => {
    const firstStep = scheduleSteps[0]?.emailTemplate ?? "gentle_reminder";
    setAiModal({ open: true, invoiceId: id, stepName: firstStep });
  }, [scheduleSteps]);

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
            onClick={() => setPortalModalOpen(true)}
            className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-surface-muted"
          >
            Client Portal
          </button>
          <Link
            href="/invoices/ai-queue"
            className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-purple-500 shadow-sm ring-1 ring-purple-500/20 transition hover:bg-purple-500/10"
          >
            AI Queue
          </Link>
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
        onGenerateAI={handleGenerateAI}
      />
      <CSVUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onUploadComplete={refetch}
      />
      {aiModal && (
        <AIReminderModal
          open={aiModal.open}
          onClose={() => setAiModal(null)}
          invoiceId={aiModal.invoiceId}
          stepName={aiModal.stepName}
          defaultTone={userTone as "professional" | "friendly" | "firm" | "casual"}
          onGenerated={refetch}
        />
      )}
      <PortalTokenModal
        isOpen={portalModalOpen}
        onClose={() => setPortalModalOpen(false)}
      />
    </div>
  );
}

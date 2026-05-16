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

export default function InvoicesClient({ initialInvoices, scheduleSteps }: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCsvModalOpen(true)}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Upload CSV
          </button>
          <Link
            href="/invoices/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            New Invoice
          </Link>
        </div>
      </div>
      <InvoiceTable invoices={invoices} onUploadCsv={() => setCsvModalOpen(true)} scheduleSteps={scheduleSteps} />
      <CSVUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onUploadComplete={refetch}
      />
    </div>
  );
}

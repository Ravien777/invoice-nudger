"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search, Upload, Plus, X, Check, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import InvoiceTable from "@/app/components/InvoiceTable";
import CSVUploadModal from "@/app/components/CSVUploadModal";
import AIReminderModal from "./components/AIReminderModal";
import PortalTokenModal from "./components/PortalTokenModal";
import { PageShell } from "@/app/components/layout/PageShell";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";

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
  paymentProbability: number | null;
  instantPayoutId: string | null;
  paidOutAt: string | null;
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
  riskScores?: Record<string, number>;
  probabilities?: Record<string, number>;
  userPlan?: string;
}

const PAGE_SIZES = [10, 20, 50] as const;

export default function InvoicesClient({
  initialInvoices,
  scheduleSteps,
  userTone = "professional",
  riskScores = {},
  probabilities = {},
  userPlan = "free",
}: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [portalModalOpen, setPortalModalOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
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
        setSelectedIds(new Set());
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }, []);

  const handlePayout = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/payouts/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id
            ? { ...inv, instantPayoutId: data.payoutId, paidOutAt: new Date().toISOString() }
            : inv,
        ),
      );
      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const handleGenerateAI = useCallback((id: string) => {
    const firstStep = scheduleSteps[0]?.emailTemplate ?? "gentle_reminder";
    setAiModal({ open: true, invoiceId: id, stepName: firstStep });
  }, [scheduleSteps]);

  const handleBulkMarkPaid = useCallback(async () => {
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const res = await handleMarkPaid(id);
      if (res.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} invoice${successCount > 1 ? "s" : ""} marked as paid`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} invoice${failCount > 1 ? "s" : ""} failed`);
    }
  }, [selectedIds, handleMarkPaid]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`Delete ${ids.length} invoice${ids.length > 1 ? "s" : ""}?`)) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const res = await handleDelete(id);
      if (res.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} invoice${successCount > 1 ? "s" : ""} deleted`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} invoice${failCount > 1 ? "s" : ""} failed`);
    }
  }, [selectedIds, handleDelete]);

  const filtered = useMemo(() => {
    let result = invoices;

    if (filter !== "all") {
      result = result.filter((inv) => inv.status === filter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.clientName.toLowerCase().includes(q) ||
          inv.clientEmail.toLowerCase().includes(q) ||
          (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((inv) => new Date(inv.dueDate) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((inv) => new Date(inv.dueDate) <= to);
    }

    return result;
  }, [invoices, filter, searchQuery, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const startItem = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, filtered.length);

  return (
    <PageShell
      title="Invoices"
      subtitle="Manage your invoices"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCsvModalOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button href="/invoices/new" size="sm">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      }
    >
      {/* Secondary nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/invoices/ai-queue"
            className="rounded-lg bg-surface-tertiary px-3 py-1.5 text-sm font-medium text-purple-500 ring-1 ring-purple-500/20 transition hover:bg-purple-500/10"
          >
            AI Queue
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPortalModalOpen(true)}
          >
            Client Portal
          </Button>
        </div>
        <span className="text-sm text-text-tertiary">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCurrentPage(1);
            setSelectedIds(new Set());
          }}
          className="w-36"
        >
          <option value="all">All</option>
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="min-w-0 flex-1"
          />
          <span className="text-text-tertiary text-sm shrink-0">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="min-w-0 flex-1"
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <Input
            icon={Search}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
              setSelectedIds(new Set());
            }}
            placeholder="Search client or invoice..."
          />
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/5 border border-accent/20 rounded-lg mb-4">
          <span className="text-sm font-medium text-accent">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border-default" />
          <Button
            variant="ghost"
            size="sm"
            className="text-success hover:text-success/80"
            onClick={handleBulkMarkPaid}
            icon={Check}
          >
            Mark as Paid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger/80"
            onClick={handleBulkDelete}
            icon={Trash2}
          >
            Delete
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-text-tertiary hover:text-text-secondary"
            onClick={() => setSelectedIds(new Set())}
            icon={X}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <InvoiceTable
        invoices={paginated}
        onUploadCsv={() => setCsvModalOpen(true)}
        scheduleSteps={scheduleSteps}
        onMarkPaid={handleMarkPaid}
        onPayout={handlePayout}
        onDelete={handleDelete}
        onGenerateAI={handleGenerateAI}
        riskScores={riskScores}
        probabilities={probabilities}
        userPlan={userPlan}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">
              Showing {startItem}–{endItem} of {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-tertiary">Rows:</span>
              <Select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs py-1 px-2"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-text-secondary px-2">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
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
    </PageShell>
  );
}

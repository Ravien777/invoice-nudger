"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Pencil, Trash2, Send, Ban, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format-currency";

interface Quote {
  id: string;
  quoteNumber: string | null;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  status: string;
  issueDate: string;
  expiryDate: string | null;
  convertedToInvoiceId: string | null;
}

export default function QuotesClient({ quotes: initialQuotes }: { quotes: Quote[] }) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);

  const handleSend = async (id: string) => {
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    if (!res.ok) {
      toast.error("Failed to send quote");
      return;
    }
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, status: "sent" } : q)));
    toast.success("Quote marked as sent");
    router.refresh();
  };

  const handleDecline = async (id: string) => {
    if (!confirm("Mark this quote as declined?")) return;
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "declined" }),
    });
    if (!res.ok) {
      toast.error("Failed to update quote");
      return;
    }
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, status: "declined" } : q)));
    toast.success("Quote marked as declined");
    router.refresh();
  };

  const handleConvert = async (id: string) => {
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to convert");
      return;
    }
    const data = await res.json();
    toast.success("Quote converted to invoice");
    setQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "accepted", convertedToInvoiceId: data.invoiceId } : q)),
    );
    router.push(`/invoices/${data.invoiceId}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this quote?")) return;
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to delete");
      return;
    }
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    toast.success("Quote deleted");
    router.refresh();
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Draft", sent: "Sent", accepted: "Accepted", declined: "Declined", expired: "Expired",
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button href="/quotes/new" size="sm">
          <Plus className="h-4 w-4" />
          New Quote
        </Button>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="Create your first quote to send a price estimate to a client."
          action={{ label: "New Quote", href: "/quotes/new" }}
        >
          <ScrollTextIcon />
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Quote #</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="text-sm text-text-secondary">{quote.issueDate}</TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {quote.quoteNumber || quote.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{quote.clientName}</TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {formatCurrency(quote.amount, quote.currency)}
                  </TableCell>
                  <TableCell>
                    {quote.convertedToInvoiceId ? (
                      <span className="inline-flex items-center gap-1">
                        <Badge variant="accepted">Converted</Badge>
                      </span>
                    ) : (
                      <Badge variant={quote.status as any}>{statusLabel(quote.status)}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {quote.status === "draft" && (
                        <>
                          <Link
                            href={`/quotes/${quote.id}/edit`}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => handleSend(quote.id)}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-accent hover:bg-surface-tertiary transition-colors"
                            title="Send"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(quote.id)}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-[var(--danger)] hover:bg-surface-tertiary transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {quote.status === "sent" && (
                        <>
                          <Link
                            href={`/quotes/${quote.id}`}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => handleConvert(quote.id)}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-[var(--success)] hover:bg-surface-tertiary transition-colors"
                            title="Convert to Invoice"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDecline(quote.id)}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-[var(--danger)] hover:bg-surface-tertiary transition-colors"
                            title="Mark Declined"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {quote.status === "accepted" && (
                        <>
                          <Link
                            href={`/quotes/${quote.id}`}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {quote.convertedToInvoiceId && (
                            <Link
                              href={`/invoices/${quote.convertedToInvoiceId}/edit`}
                              className="p-2.5 rounded-md text-text-tertiary hover:text-[var(--success)] hover:bg-surface-tertiary transition-colors"
                              title="View Invoice"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </>
                      )}
                      {(quote.status === "declined" || quote.status === "expired") && (
                        <>
                          <Link
                            href={`/quotes/${quote.id}`}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => handleDelete(quote.id)}
                            className="p-2.5 rounded-md text-text-tertiary hover:text-[var(--danger)] hover:bg-surface-tertiary transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ScrollTextIcon() {
  return (
    <svg className="h-12 w-12 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h12" />
    </svg>
  );
}

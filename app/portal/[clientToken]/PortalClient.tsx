"use client";

import { useState } from "react";
import { PortalBranding } from "@/lib/portal";
import { formatCurrency } from "@/lib/format-currency";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  projectName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  notes: string | null;
  paymentLink: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface QuoteData {
  id: string;
  quoteNumber: string | null;
  clientName: string;
  amount: number;
  currency: string;
  status: string;
  issueDate: string;
  expiryDate: string | null;
  quoteToken: string;
}

interface PortalClientProps {
  invoices: Invoice[];
  quotes: QuoteData[];
  branding: PortalBranding;
  clientName: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "bg-[var(--success-muted)] text-[var(--success)]";
    case "overdue":
      return "bg-[var(--danger-muted)] text-[var(--danger)]";
    case "cancelled":
      return "bg-surface-muted text-muted";
    default:
      return "bg-[var(--warning-muted)] text-[var(--warning)]";
  }
}

function getQuoteStatusColor(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-[var(--success-muted)] text-[var(--success)]";
    case "declined":
      return "bg-[var(--danger-muted)] text-[var(--danger)]";
    case "expired":
      return "bg-surface-muted text-muted";
    case "sent":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-surface-muted text-muted";
  }
}

function isOverdue(invoice: Invoice): boolean {
  return invoice.status !== "paid" && invoice.status !== "cancelled" && new Date(invoice.dueDate) < new Date();
}

export default function PortalClient({ invoices, quotes, branding, clientName }: PortalClientProps) {
  const [tab, setTab] = useState<"invoices" | "quotes" | "history">("invoices");
  const [actionedQuotes, setActionedQuotes] = useState<Set<string>>(new Set());
  const accentColor = branding.accentColor || "#2563eb";

  const totalUnpaid = invoices
    .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const overdueCount = invoices.filter(isOverdue).length;

  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const sortedInvoices = [...invoices].sort((a, b) => {
    const statusOrder = { overdue: 0, unpaid: 1, paid: 2, cancelled: 3 };
    const aStatus = isOverdue(a) ? "overdue" : a.status;
    const bStatus = isOverdue(b) ? "overdue" : b.status;
    return (statusOrder[aStatus as keyof typeof statusOrder] ?? 1) - (statusOrder[bStatus as keyof typeof statusOrder] ?? 1);
  });

  const activeInvoices = sortedInvoices.filter(
    (inv) => inv.status !== "paid" && inv.status !== "cancelled"
  );

  const historyInvoices = sortedInvoices.filter(
    (inv) => inv.status === "paid"
  );

  const pendingQuotes = quotes.filter((q) => q.status === "sent");
  const otherQuotes = quotes.filter((q) => q.status !== "sent");

  const handleQuoteAction = async (quoteId: string, action: "accepted" | "declined") => {
    const quote = quotes.find((q) => q.id === quoteId);
    const res = await fetch(`/api/quotes/${quoteId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: quote?.quoteToken }),
    });
    if (res.ok) {
      setActionedQuotes((prev) => new Set(prev).add(quoteId));
    }
  };

  const tabs = [
    { key: "invoices" as const, label: "Invoices", count: activeInvoices.length },
    { key: "quotes" as const, label: "Quotes", count: pendingQuotes.length },
    { key: "history" as const, label: "History", count: historyInvoices.length },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ ["--portal-accent" as string]: accentColor } as React.CSSProperties}
    >
      {branding.faviconUrl && (
        <link rel="icon" href={branding.faviconUrl} />
      )}

      <header className="border-b border-border bg-surface" style={{ borderTop: `3px solid ${accentColor}` }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-10 w-10 rounded-lg object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                {(branding.businessName || "B").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{branding.businessName || "Business"}</h1>
              {branding.tagline && (
                <p className="text-xs text-muted">{branding.tagline}</p>
              )}
            </div>
          </div>
          {clientName && (
            <p className="text-sm text-muted">Welcome, {clientName}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm text-muted">Total Unpaid</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatCurrency(totalUnpaid, invoices[0]?.currency || "USD")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm text-muted">Overdue</p>
            <p className="mt-1 text-2xl font-bold text-[var(--danger)]">{overdueCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm text-muted">Total Paid</p>
            <p className="mt-1 text-2xl font-bold text-[var(--success)]">
              {formatCurrency(totalPaid, invoices[0]?.currency || "USD")}
            </p>
          </div>
        </div>

        {invoices.length === 0 && quotes.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
            <p className="text-muted">No invoices or quotes found.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-1 border-b border-border">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? "text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span
                      className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      {t.count}
                    </span>
                  )}
                  {tab === t.key && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                </button>
              ))}
            </div>

            {tab === "invoices" && (
              <>
                {activeInvoices.length === 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
                    <p className="text-muted">All invoices are paid. Check the History tab.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden rounded-xl border border-border bg-surface shadow-sm md:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Invoice</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Project</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Due Date</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Amount</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Status</th>
                            <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {activeInvoices.map((invoice) => {
                            const overdue = isOverdue(invoice);
                            const displayStatus = overdue ? "overdue" : invoice.status;
                            return (
                              <tr key={invoice.id} className="transition hover:bg-surface-muted">
                                <td className="px-5 py-4 text-sm font-medium text-foreground">
                                  {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : "Invoice"}
                                </td>
                                <td className="px-5 py-4 text-sm text-muted">
                                  {invoice.projectName || "—"}
                                </td>
                                <td className="px-5 py-4 text-sm text-muted">
                                  {formatDate(invoice.dueDate)}
                                </td>
                                <td className="px-5 py-4 text-sm font-semibold text-foreground">
                                  {formatCurrency(invoice.amount, invoice.currency)}
                                </td>
                                <td className="px-5 py-4">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(displayStatus)}`}>
                                    {displayStatus}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                  {invoice.paymentLink ? (
                                    <a
                                      href={invoice.paymentLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
                                      style={{ backgroundColor: accentColor }}
                                    >
                                      Pay Now
                                    </a>
                                  ) : (
                                    <span className="text-xs text-muted">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 md:hidden">
                      {activeInvoices.map((invoice) => {
                        const overdue = isOverdue(invoice);
                        const displayStatus = overdue ? "overdue" : invoice.status;
                        return (
                          <div key={invoice.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : "Invoice"}
                              </span>
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(displayStatus)}`}>
                                {displayStatus}
                              </span>
                            </div>
                            {invoice.projectName && (
                              <p className="mb-2 text-sm text-muted">{invoice.projectName}</p>
                            )}
                            <div className="mb-3 flex justify-between text-sm">
                              <span className="text-muted">Due</span>
                              <span className="font-medium text-foreground">{formatDate(invoice.dueDate)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-foreground">
                                {formatCurrency(invoice.amount, invoice.currency)}
                              </span>
                              {invoice.paymentLink ? (
                                <a
                                  href={invoice.paymentLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                                  style={{ backgroundColor: accentColor }}
                                >
                                  Pay Now
                                </a>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {tab === "quotes" && (
              <>
                {pendingQuotes.length === 0 && otherQuotes.length === 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
                    <p className="text-muted">No quotes yet.</p>
                  </div>
                ) : (
                  <>
                    {pendingQuotes.length > 0 && (
                      <>
                        <h3 className="mb-3 text-sm font-semibold text-foreground">Pending Response</h3>
                        <div className="hidden rounded-xl border border-border bg-surface shadow-sm md:block">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Date</th>
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Quote</th>
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Amount</th>
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Expires</th>
                                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {pendingQuotes.map((quote) => {
                                const actioned = actionedQuotes.has(quote.id);
                                return (
                                  <tr key={quote.id} className="transition hover:bg-surface-muted">
                                    <td className="px-5 py-4 text-sm text-muted">{formatDate(quote.issueDate)}</td>
                                    <td className="px-5 py-4 text-sm font-medium text-foreground">
                                      {quote.quoteNumber ? `#${quote.quoteNumber}` : "Quote"}
                                    </td>
                                    <td className="px-5 py-4 text-sm font-semibold text-foreground">
                                      {formatCurrency(quote.amount, quote.currency)}
                                    </td>
                                    <td className="px-5 py-4 text-sm text-muted">
                                      {quote.expiryDate ? formatDate(quote.expiryDate) : "—"}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                      {actioned ? (
                                        <span className="text-xs font-medium text-[var(--success)]">Responded</span>
                                      ) : (
                                        <div className="flex justify-end gap-2">
                                          <button
                                            onClick={() => handleQuoteAction(quote.id, "accepted")}
                                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            onClick={() => handleQuoteAction(quote.id, "declined")}
                                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
                                          >
                                            Decline
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-3 md:hidden">
                          {pendingQuotes.map((quote) => {
                            const actioned = actionedQuotes.has(quote.id);
                            return (
                              <div key={quote.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-sm font-semibold text-foreground">
                                    {quote.quoteNumber ? `#${quote.quoteNumber}` : "Quote"}
                                  </span>
                                </div>
                                <div className="mb-3 space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted">Amount</span>
                                    <span className="font-semibold text-foreground">
                                      {formatCurrency(quote.amount, quote.currency)}
                                    </span>
                                  </div>
                                  {quote.expiryDate && (
                                    <div className="flex justify-between">
                                      <span className="text-muted">Expires</span>
                                      <span className="text-foreground">{formatDate(quote.expiryDate)}</span>
                                    </div>
                                  )}
                                </div>
                                {actioned ? (
                                  <span className="block text-center text-xs font-medium text-[var(--success)]">Responded</span>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleQuoteAction(quote.id, "accepted")}
                                      className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => handleQuoteAction(quote.id, "declined")}
                                      className="flex-1 rounded-lg border border-border bg-surface py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {otherQuotes.length > 0 && (
                      <>
                        <h3 className={`mb-3 text-sm font-semibold text-foreground ${pendingQuotes.length > 0 ? "mt-8" : ""}`}>History</h3>
                        <div className="hidden rounded-xl border border-border bg-surface shadow-sm md:block">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Date</th>
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Quote</th>
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Amount</th>
                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {otherQuotes.map((quote) => (
                                <tr key={quote.id} className="transition hover:bg-surface-muted">
                                  <td className="px-5 py-4 text-sm text-muted">{formatDate(quote.issueDate)}</td>
                                  <td className="px-5 py-4 text-sm font-medium text-foreground">
                                    {quote.quoteNumber ? `#${quote.quoteNumber}` : "Quote"}
                                  </td>
                                  <td className="px-5 py-4 text-sm font-semibold text-foreground">
                                    {formatCurrency(quote.amount, quote.currency)}
                                  </td>
                                  <td className="px-5 py-4">
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getQuoteStatusColor(quote.status)}`}>
                                      {quote.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-3 md:hidden">
                          {otherQuotes.map((quote) => (
                            <div key={quote.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">
                                  {quote.quoteNumber ? `#${quote.quoteNumber}` : "Quote"}
                                </span>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getQuoteStatusColor(quote.status)}`}>
                                  {quote.status}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted">Amount</span>
                                <span className="font-semibold text-foreground">
                                  {formatCurrency(quote.amount, quote.currency)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {tab === "history" && (
              <>
                {historyInvoices.length === 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
                    <p className="text-muted">No paid invoices yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden rounded-xl border border-border bg-surface shadow-sm md:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Date Paid</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Invoice</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Project</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Amount</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {historyInvoices.map((invoice) => (
                            <tr key={invoice.id} className="transition hover:bg-surface-muted">
                              <td className="px-5 py-4 text-sm text-muted">
                                {invoice.paidAt ? formatDate(invoice.paidAt) : "—"}
                              </td>
                              <td className="px-5 py-4 text-sm font-medium text-foreground">
                                {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : "Invoice"}
                              </td>
                              <td className="px-5 py-4 text-sm text-muted">
                                {invoice.projectName || "—"}
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-foreground">
                                {formatCurrency(invoice.amount, invoice.currency)}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                                  {invoice.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 md:hidden">
                      {historyInvoices.map((invoice) => (
                        <div key={invoice.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">
                              {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : "Invoice"}
                            </span>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </div>
                          {invoice.projectName && (
                            <p className="mb-1 text-sm text-muted">{invoice.projectName}</p>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted">Paid</span>
                            <span className="font-medium text-foreground">
                              {invoice.paidAt ? formatDate(invoice.paidAt) : "—"}
                            </span>
                          </div>
                          <div className="mt-2 text-right text-lg font-bold text-foreground">
                            {formatCurrency(invoice.amount, invoice.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border bg-surface py-6">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-muted">
          Powered by <span className="font-medium">Maroni</span>
        </div>
      </footer>
    </div>
  );
}

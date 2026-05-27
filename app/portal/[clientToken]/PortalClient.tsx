"use client";

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
  createdAt: string;
}

interface PortalClientProps {
  invoices: Invoice[];
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

function isOverdue(invoice: Invoice): boolean {
  return invoice.status !== "paid" && invoice.status !== "cancelled" && new Date(invoice.dueDate) < new Date();
}

export default function PortalClient({ invoices, branding, clientName }: PortalClientProps) {
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
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
            <p className="text-muted">No invoices found.</p>
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <p className="text-sm text-muted">Total Unpaid</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(totalUnpaid, invoices[0]?.currency || "USD")}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <p className="text-sm text-muted">Overdue</p>
                <p className="mt-1 text-2xl font-bold text-[var(--danger)]">{overdueCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <p className="text-sm text-muted">Total Paid</p>
                <p className="mt-1 text-2xl font-bold text-[var(--success)]">{formatCurrency(totalPaid, invoices[0]?.currency || "USD")}</p>
              </div>
            </div>

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
                  {sortedInvoices.map((invoice) => {
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
                          {invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.paymentLink ? (
                            <a
                              href={invoice.paymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
                              style={{ backgroundColor: accentColor }}
                            >
                              Pay Now
                            </a>
                          ) : invoice.status === "paid" ? (
                            <span className="text-xs text-[var(--success)]">Paid</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {sortedInvoices.map((invoice) => {
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
                      {invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.paymentLink ? (
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
      </main>

      <footer className="border-t border-border bg-surface py-6">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-muted">
          Powered by <span className="font-medium">Maroni</span>
        </div>
      </footer>
    </div>
  );
}

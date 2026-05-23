"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface ClientProfile {
  id: string;
  userId: string;
  clientEmail: string;
  totalInvoices: number;
  paidInvoices: number;
  onTimePayments: number;
  totalAmount: number;
  avgDaysLate: number | null;
  lastPaymentDate: string | null;
  riskScore: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientsClientProps {
  initialProfiles: ClientProfile[];
}

type SortField = "clientEmail" | "riskScore" | "totalAmount" | "lastPaymentDate";
type SortDir = "asc" | "desc";

function riskLevel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: "Unknown", color: "bg-surface-muted text-muted" };
  if (score <= 0.3) return { label: "Low", color: "bg-[var(--success-muted)] text-[var(--success)]" };
  if (score <= 0.7) return { label: "Medium", color: "bg-[var(--warning-muted)] text-[var(--warning)]" };
  return { label: "High", color: "bg-[var(--danger-muted)] text-[var(--danger)]" };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function onTimePercent(paid: number, onTime: number): string {
  if (paid === 0) return "-";
  return ((onTime / paid) * 100).toFixed(0) + "%";
}

export default function ClientsClient({ initialProfiles }: ClientsClientProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return initialProfiles.filter((p) =>
      p.clientEmail.toLowerCase().includes(q)
    );
  }, [search, initialProfiles]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "clientEmail":
          cmp = a.clientEmail.localeCompare(b.clientEmail);
          break;
        case "riskScore":
          cmp = (a.riskScore ?? 1) - (b.riskScore ?? 1);
          break;
        case "totalAmount":
          cmp = a.totalAmount - b.totalAmount;
          break;
        case "lastPaymentDate":
          cmp = (a.lastPaymentDate ?? "").localeCompare(b.lastPaymentDate ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function sortArrow(field: SortField): string {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  if (initialProfiles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
        <p className="text-muted">No client payment data yet.</p>
        <p className="mt-2 text-sm text-muted">
          Client profiles will appear once you create invoices and record payments.
        </p>
        <Link
          href="/invoices/new"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110"
        >
          Create your first invoice
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground placeholder-muted outline-none focus:border-accent"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-muted hover:text-foreground"
                onClick={() => toggleSort("clientEmail")}
              >
                Client Email{sortArrow("clientEmail")}
              </th>
              <th className="px-4 py-3 font-medium text-muted">Total Invoices</th>
              <th className="px-4 py-3 font-medium text-muted">On-Time %</th>
              <th className="px-4 py-3 font-medium text-muted">Avg Days Late</th>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-muted hover:text-foreground"
                onClick={() => toggleSort("riskScore")}
              >
                Risk Level{sortArrow("riskScore")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-muted hover:text-foreground"
                onClick={() => toggleSort("totalAmount")}
              >
                Total Amount{sortArrow("totalAmount")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium text-muted hover:text-foreground"
                onClick={() => toggleSort("lastPaymentDate")}
              >
                Last Payment{sortArrow("lastPaymentDate")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((p) => {
              const risk = riskLevel(p.riskScore);
              return (
                <tr
                  key={p.id}
                  className="cursor-pointer transition hover:bg-surface-muted"
                  onClick={() =>
                    window.location.href = `/clients/${encodeURIComponent(p.clientEmail)}`
                  }
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {p.clientEmail}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.totalInvoices}</td>
                  <td className="px-4 py-3 text-muted">
                    {onTimePercent(p.paidInvoices, p.onTimePayments)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {p.avgDaysLate !== null ? `${p.avgDaysLate.toFixed(1)} days` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${risk.color}`}>
                      {risk.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatCurrency(p.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(p.lastPaymentDate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        Showing {sorted.length} of {initialProfiles.length} clients
      </p>
    </div>
  );
}

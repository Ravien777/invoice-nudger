"use client";

import { useState, useMemo } from "react";

import { Input } from "@/app/components/ui/Input";
import { EmptyState } from "@/app/components/ui/EmptyState";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/app/components/ui/Table";
import { formatCurrency } from "@/lib/format-currency";

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

type SortField =
  | "clientEmail"
  | "riskScore"
  | "totalAmount"
  | "lastPaymentDate";
type SortDir = "asc" | "desc";

function riskLevel(score: number | null): { label: string; badge: string } {
  if (score === null)
    return { label: "Unknown", badge: "bg-surface-tertiary text-text-tertiary" };
  if (score <= 0.3)
    return { label: "Low", badge: "bg-success/10 text-success" };
  if (score <= 0.7)
    return { label: "Medium", badge: "bg-warning/10 text-warning" };
  return { label: "High", badge: "bg-danger/10 text-danger" };
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

export default function ClientsClient({
  initialProfiles,
}: ClientsClientProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return initialProfiles.filter((p) =>
      p.clientEmail.toLowerCase().includes(q),
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
          cmp = (a.lastPaymentDate ?? "").localeCompare(
            b.lastPaymentDate ?? "",
          );
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
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  if (initialProfiles.length === 0) {
    return (
      <EmptyState
        variant="no-clients"
        action={{ label: "Create your first invoice", href: "/invoices/new" }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell
              onClick={() => toggleSort("clientEmail")}
              className="cursor-pointer hover:text-text-primary"
            >
              Client Email{sortArrow("clientEmail")}
            </TableCell>
            <TableCell>Total Invoices</TableCell>
            <TableCell>On-Time %</TableCell>
            <TableCell>Avg Days Late</TableCell>
            <TableCell
              onClick={() => toggleSort("riskScore")}
              className="cursor-pointer hover:text-text-primary"
            >
              Risk Level{sortArrow("riskScore")}
            </TableCell>
            <TableCell
              onClick={() => toggleSort("totalAmount")}
              className="cursor-pointer hover:text-text-primary"
            >
              Total Amount{sortArrow("totalAmount")}
            </TableCell>
            <TableCell
              onClick={() => toggleSort("lastPaymentDate")}
              className="cursor-pointer hover:text-text-primary"
            >
              Last Payment{sortArrow("lastPaymentDate")}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((p) => {
            const risk = riskLevel(p.riskScore);
            return (
              <TableRow
                key={p.id}
                onClick={() =>
                  (window.location.href = `/clients/${encodeURIComponent(p.clientEmail)}`)
                }
                className="cursor-pointer"
              >
                <TableCell className="font-medium text-text-primary">
                  {p.clientEmail}
                </TableCell>
                <TableCell>{p.totalInvoices}</TableCell>
                <TableCell>
                  {onTimePercent(p.paidInvoices, p.onTimePayments)}
                </TableCell>
                <TableCell>
                  {p.avgDaysLate !== null
                    ? `${p.avgDaysLate.toFixed(1)} days`
                    : "-"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${risk.badge}`}
                  >
                    {risk.label}
                  </span>
                </TableCell>
                <TableCell className="font-medium text-text-primary">
                  {formatCurrency(p.totalAmount)}
                </TableCell>
                <TableCell>{formatDate(p.lastPaymentDate)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-3 text-xs text-text-tertiary">
        Showing {sorted.length} of {initialProfiles.length} clients
      </p>
    </div>
  );
}

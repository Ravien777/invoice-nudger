"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  ChevronDown,
  ChevronUp,
  Calculator,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { StatCard } from "@/app/components/ui/StatCard";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format-currency";

interface AllocationRecordItem {
  id: string;
  totalReceived: number;
  taxAmount: number;
  operatingAmount: number;
  profitAmount: number;
  ownerPayAmount: number;
  currency: string;
  invoiceId: string | null;
  note: string | null;
  createdAt: string;
}

interface MoneyClientProps {
  initialProfile: {
    taxPercent: number;
    operatingPercent: number;
    profitPercent: number;
    ownerPayPercent: number;
    currency: string;
  } | null;
  initialRecords: AllocationRecordItem[];
  initialTotals: {
    totalReceived: number;
    taxAmount: number;
    operatingAmount: number;
    profitAmount: number;
    ownerPayAmount: number;
  };
}

const DEFAULT_PROFILE = {
  taxPercent: 25,
  operatingPercent: 30,
  profitPercent: 5,
  ownerPayPercent: 40,
  currency: "USD",
};

export default function MoneyClient({
  initialProfile,
  initialRecords,
  initialTotals,
}: MoneyClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile ?? DEFAULT_PROFILE);
  const [records] = useState(initialRecords);
  const [totals] = useState(initialTotals);

  const [editing, setEditing] = useState(false);
  const [editTax, setEditTax] = useState(profile.taxPercent);
  const [editOperating, setEditOperating] = useState(profile.operatingPercent);
  const [editProfit, setEditProfit] = useState(profile.profitPercent);
  const [editOwnerPay, setEditOwnerPay] = useState(profile.ownerPayPercent);
  const [saving, setSaving] = useState(false);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorAmount, setCalculatorAmount] = useState("");

  const currentSum = editTax + editOperating + editProfit + editOwnerPay;
  const sumValid = currentSum === 100;

  const startEditing = () => {
    setEditTax(profile.taxPercent);
    setEditOperating(profile.operatingPercent);
    setEditProfit(profile.profitPercent);
    setEditOwnerPay(profile.ownerPayPercent);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveProfile = async () => {
    if (!sumValid) {
      toast.error(`Percentages must add up to 100. Currently: ${currentSum}.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/allocation/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxPercent: editTax,
          operatingPercent: editOperating,
          profitPercent: editProfit,
          ownerPayPercent: editOwnerPay,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save allocation profile");
        return;
      }

      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
      toast.success("Allocation split saved");
      router.refresh();
    } catch {
      toast.error("Failed to save allocation profile");
    } finally {
      setSaving(false);
    }
  };

  const calcAmount = parseFloat(calculatorAmount) || 0;
  const calcTax = round2(calcAmount * (profile.taxPercent / 100));
  const calcOperating = round2(calcAmount * (profile.operatingPercent / 100));
  const calcProfit = round2(calcAmount * (profile.profitPercent / 100));
  const calcOwnerPay = round2(calcAmount * (profile.ownerPayPercent / 100));

  return (
    <div className="space-y-8">
      {/* Your Split */}
      <section className="rounded-xl border border-border-default bg-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-primary">Your Split</h2>
          {!editing && (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <PercentInput
                label="Tax"
                value={editTax}
                onChange={setEditTax}
                color="text-[var(--danger)]"
              />
              <PercentInput
                label="Business"
                value={editOperating}
                onChange={setEditOperating}
                color="text-[var(--accent)]"
              />
              <PercentInput
                label="Profit"
                value={editProfit}
                onChange={setEditProfit}
                color="text-[var(--success)]"
              />
              <PercentInput
                label="Me"
                value={editOwnerPay}
                onChange={setEditOwnerPay}
                color="text-[var(--warning)]"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className={`text-sm ${sumValid ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                Total: {currentSum}% {sumValid ? "✓" : "— must equal 100%"}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveProfile} disabled={saving || !sumValid}>
                  {saving ? "Saving..." : "Save my split"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SplitCard label="Tax" percent={profile.taxPercent} color="text-[var(--danger)]" />
            <SplitCard label="Business" percent={profile.operatingPercent} color="text-[var(--accent)]" />
            <SplitCard label="Profit" percent={profile.profitPercent} color="text-[var(--success)]" />
            <SplitCard label="Me" percent={profile.ownerPayPercent} color="text-[var(--warning)]" />
          </div>
        )}
      </section>

      {/* Running Totals This Year */}
      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Running Totals This Year</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Total Received" value={formatCurrency(totals.totalReceived, profile.currency)}>
            <Wallet className="h-5 w-5 text-text-tertiary" />
          </StatCard>
          <StatCard
            label="Set Aside for Tax"
            value={formatCurrency(totals.taxAmount, profile.currency)}
            variant="warning"
          >
            <Wallet className="h-5 w-5 text-text-tertiary" />
          </StatCard>
          <StatCard label="Kept in Business" value={formatCurrency(totals.operatingAmount, profile.currency)}>
            <Wallet className="h-5 w-5 text-text-tertiary" />
          </StatCard>
          <StatCard label="Paid to Yourself" value={formatCurrency(totals.ownerPayAmount, profile.currency)}>
            <Wallet className="h-5 w-5 text-text-tertiary" />
          </StatCard>
          <StatCard label="Profit Buffer" value={formatCurrency(totals.profitAmount, profile.currency)}>
            <Wallet className="h-5 w-5 text-text-tertiary" />
          </StatCard>
        </div>
      </section>

      {/* Recent Payments */}
      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Recent Payments</h2>
        {records.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description="Your first allocation will appear here when a payment comes in."
          >
            <Wallet className="h-12 w-12 text-text-tertiary" />
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Total Received</TableCell>
                  <TableCell>Tax ({profile.taxPercent}%)</TableCell>
                  <TableCell>Business ({profile.operatingPercent}%)</TableCell>
                  <TableCell>Profit ({profile.profitPercent}%)</TableCell>
                  <TableCell>Me ({profile.ownerPayPercent}%)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-text-secondary">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium text-text-primary">
                      {formatCurrency(r.totalReceived, r.currency)}
                    </TableCell>
                    <TableCell className="text-[var(--danger)]">
                      {formatCurrency(r.taxAmount, r.currency)}
                    </TableCell>
                    <TableCell className="text-[var(--accent)]">
                      {formatCurrency(r.operatingAmount, r.currency)}
                    </TableCell>
                    <TableCell className="text-[var(--success)]">
                      {formatCurrency(r.profitAmount, r.currency)}
                    </TableCell>
                    <TableCell className="text-[var(--warning)]">
                      {formatCurrency(r.ownerPayAmount, r.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* What If? Calculator */}
      <section className="rounded-xl border border-border-default bg-surface">
        <button
          onClick={() => setCalculatorOpen(!calculatorOpen)}
          className="flex items-center justify-between w-full px-6 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">What if?</span>
          </div>
          {calculatorOpen ? (
            <ChevronUp className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          )}
        </button>

        {calculatorOpen && (
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-text-secondary">
              See how a payment would be split using your current allocation percentages.
            </p>
            <div className="max-w-xs">
              <label className="block text-xs text-text-secondary mb-1">If I receive:</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={calculatorAmount}
                  onChange={(e) => setCalculatorAmount(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary pl-7 pr-3 py-2 text-sm text-text-primary placeholder-text-tertiary"
                  placeholder="0.00"
                />
              </div>
            </div>

            {calcAmount > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <CalcBucket
                  label="Tax"
                  percent={profile.taxPercent}
                  amount={calcTax}
                  currency={profile.currency}
                  color="text-[var(--danger)]"
                />
                <CalcBucket
                  label="Business"
                  percent={profile.operatingPercent}
                  amount={calcOperating}
                  currency={profile.currency}
                  color="text-[var(--accent)]"
                />
                <CalcBucket
                  label="Profit"
                  percent={profile.profitPercent}
                  amount={calcProfit}
                  currency={profile.currency}
                  color="text-[var(--success)]"
                />
                <CalcBucket
                  label="Me"
                  percent={profile.ownerPayPercent}
                  amount={calcOwnerPay}
                  currency={profile.currency}
                  color="text-[var(--warning)]"
                />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function PercentInput({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <label className={`block text-xs font-medium mb-1 ${color}`}>{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
          className="w-full rounded-lg border border-border-default bg-surface-secondary pr-8 pl-3 py-2 text-sm text-text-primary text-right"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">%</span>
      </div>
    </div>
  );
}

function SplitCard({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-surface-secondary p-4 text-center">
      <p className={`text-lg font-bold ${color}`}>{percent}%</p>
      <p className="text-xs text-text-secondary mt-1">{label}</p>
    </div>
  );
}

function CalcBucket({
  label,
  percent,
  amount,
  currency,
  color,
}: {
  label: string;
  percent: number;
  amount: number;
  currency: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-surface-secondary p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-text-secondary">{label}</p>
        <p className={`text-xs font-medium ${color}`}>{percent}%</p>
      </div>
      <p className="text-sm font-semibold text-text-primary">{formatCurrency(amount, currency)}</p>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

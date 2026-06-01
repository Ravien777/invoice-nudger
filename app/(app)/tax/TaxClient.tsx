"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import Link from "next/link";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/app/components/ui/Button";
import toast from "react-hot-toast";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format-currency";

interface TaxEstimate {
  year: number;
  grossIncome: number;
  totalExpenses: number;
  taxableIncome: number;
  estimatedTax: number;
  taxRate: number;
  taxSavingsAmount: number;
}

interface PnLIncome {
  month: string;
  invoices: number;
  total: number;
}

interface PnLExpense {
  category: string;
  items: number;
  total: number;
  taxDeductible: number;
}

interface PnLReport {
  year: number;
  income: PnLIncome[];
  expenses: PnLExpense[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    estimatedTax: number;
    taxRate: number;
  };
}

const MONTH_NAMES: Record<string, string> = {
  "01": "January",
  "02": "February",
  "03": "March",
  "04": "April",
  "05": "May",
  "06": "June",
  "07": "July",
  "08": "August",
  "09": "September",
  "10": "October",
  "11": "November",
  "12": "December",
};

function formatMonth(month: string) {
  const [, m] = month.split("-");
  return MONTH_NAMES[m] || month;
}

export default function TaxClient({
  initialYear,
  taxRate: initialTaxRate,
  fiscalYearStart,
  plan,
  initialTaxSavings,
  baseCurrency = "USD",
}: {
  initialYear: number;
  taxRate: number;
  fiscalYearStart: number;
  plan: string;
  initialTaxSavings: number;
  baseCurrency?: string;
}) {
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<TaxEstimate | null>(null);
  const [pnl, setPnl] = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPnL, setShowPnL] = useState(false);
  const [savingsInput, setSavingsInput] = useState(
    String(Math.round(initialTaxSavings)),
  );
  const [savingSavings, setSavingSavings] = useState(false);

  const isPro = plan === "pro" || plan === "agency";
  const printableRef = useRef<HTMLDivElement>(null);
  const handlePrintPdf = useReactToPrint({
    contentRef: printableRef,
    documentTitle: `profit-loss-${year}`,
  });

  const fetchData = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const [taxRes, pnlRes] = await Promise.all([
        fetch(`/api/reports/tax-estimate?year=${y}`),
        fetch(`/api/reports/profit-loss?year=${y}`),
      ]);
      if (taxRes.ok) setData(await taxRes.json());
      if (pnlRes.ok) setPnl(await pnlRes.json());
    } catch {
      toast.error("Failed to load tax data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(year);
  }, [year, fetchData]);

  const years = [];
  for (let i = -2; i <= 0; i++) {
    years.push(initialYear + i);
  }

  const handleSaveSavings = async () => {
    setSavingSavings(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxSavingsAmount: Number(savingsInput) || 0 }),
      });
      if (!res.ok) {
        toast.error("Failed to update savings amount");
        return;
      }
      toast.success("Savings amount updated");
      if (data)
        setData({ ...data, taxSavingsAmount: Number(savingsInput) || 0 });
    } finally {
      setSavingSavings(false);
    }
  };

  const downloadCSV = () => {
    if (!pnl) return;

    const incomeRows = pnl.income.map((r) => ({
      Section: "INCOME",
      Month: formatMonth(r.month),
      Invoices: r.invoices,
      Amount: r.total,
    }));
    const expenseRows = pnl.expenses.map((r) => ({
      Section: "EXPENSES",
      Category: r.category,
      Items: r.items,
      Amount: r.total,
      "Tax Deductible": r.taxDeductible,
    }));
    const csv = Papa.unparse([
      ...incomeRows,
      {
        Section: "TOTAL INCOME",
        Month: "",
        Invoices: "",
        Amount: pnl.summary.totalIncome,
      },
      {},
      {
        Section: "EXPENSES",
        Category: "Items",
        Items: "Amount",
        "Tax Deductible": "Tax Deductible",
      },
      ...expenseRows,
      {
        Section: "TOTAL EXPENSES",
        Category: "",
        Items: "",
        Amount: pnl.summary.totalExpenses,
        "Tax Deductible": "",
      },
      {},
      {
        Section: "NET PROFIT",
        Category: "",
        Items: "",
        Amount: pnl.summary.netProfit,
      },
      {
        Section: `ESTIMATED TAX (${(pnl.summary.taxRate * 100).toFixed(0)}%)`,
        Category: "",
        Items: "",
        Amount: pnl.summary.estimatedTax,
      },
    ]);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-text-secondary">Tax Year:</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-border-default bg-surface px-3 py-1.5 text-sm text-text-primary"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}/{String(y + 1).slice(2)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border-default bg-surface p-6 animate-pulse"
            >
              <div className="h-4 w-24 bg-surface-tertiary rounded mb-3" />
              <div className="h-8 w-32 bg-surface-tertiary rounded" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* 4 cards in 2×2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border-default bg-surface p-6">
              <p className="text-sm text-text-secondary mb-1">Total Earned</p>
              <p className="text-3xl font-bold text-text-primary">
                {formatCurrencyCompact(data.grossIncome, baseCurrency)}
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-surface p-6">
              <p className="text-sm text-text-secondary mb-1">
                Tax-Deductible Expenses
              </p>
              <p className="text-3xl font-bold text-text-primary">
                {formatCurrencyCompact(data.totalExpenses, baseCurrency)}
              </p>
            </div>
            <div className="rounded-xl border border-l-2 border-l-accent bg-surface p-6 shadow-sm">
              <p className="text-sm text-text-secondary mb-1">Taxable Income</p>
              <p className="text-3xl font-bold text-text-primary">
                {formatCurrencyCompact(data.taxableIncome, baseCurrency)}
              </p>
            </div>
            <div className="rounded-xl border border-l-2 border-l-[var(--warning)] bg-surface p-6 shadow-sm">
              <p className="text-sm text-text-secondary mb-1">Set Aside</p>
              <p className="text-3xl font-bold text-[var(--warning)]">
                {formatCurrencyCompact(data.estimatedTax, baseCurrency)}
              </p>
            </div>
          </div>

          {/* Formula breakdown */}
          <div className="rounded-xl border border-border-default bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm font-mono text-text-primary">
              <span className="font-semibold">
                {formatCurrencyCompact(data.grossIncome, baseCurrency)}
              </span>
              <span className="text-text-tertiary">Earned</span>
              <span className="text-text-tertiary">−</span>
              <span className="font-semibold">
                {formatCurrencyCompact(data.totalExpenses, baseCurrency)}
              </span>
              <span className="text-text-tertiary">Expenses</span>
              <span className="text-text-tertiary">=</span>
              <span className="font-semibold">
                {formatCurrencyCompact(data.taxableIncome, baseCurrency)}
              </span>
              <span className="text-text-tertiary">Taxable</span>
              <span className="text-text-tertiary">×</span>
              <span className="font-semibold">
                {(data.taxRate * 100).toFixed(0)}%
              </span>
              <span className="text-text-tertiary">=</span>
              <span className="font-bold text-[var(--warning)]">
                {formatCurrencyCompact(data.estimatedTax, baseCurrency)}
              </span>
              <span className="text-text-tertiary">Set Aside</span>
            </div>
          </div>

          {/* Set Aside tracker (Pro feature) */}
          {isPro ? (
            <div className="rounded-xl border border-border-default bg-surface p-5">
              <h3 className="text-sm font-medium text-text-primary mb-3">
                Set Aside Tracker
              </h3>
              <p className="text-sm text-text-secondary mb-3">
                You&apos;ve set aside:{" "}
                <span className="font-semibold text-text-primary">
                  {formatCurrencyCompact(data.taxSavingsAmount, baseCurrency)}
                </span>{" "}
                of {formatCurrencyCompact(data.estimatedTax, baseCurrency)}
              </p>
              <div className="flex flex-wrap items-center gap-2 max-w-xs">
                <input
                  type="number"
                  value={savingsInput}
                  onChange={(e) => setSavingsInput(e.target.value)}
                  className="flex-1 rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
                  placeholder="Amount saved"
                />
                <Button
                  size="sm"
                  onClick={handleSaveSavings}
                  loading={savingSavings}
                >
                  Update
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border-default bg-surface p-5 opacity-60">
              <p className="text-sm text-text-secondary">
                Set aside tracker available on Pro plan.{" "}
                <Link
                  href="/settings/billing"
                  className="text-accent underline"
                >
                  Upgrade to track your savings
                </Link>
              </p>
            </div>
          )}

          {/* P&L Report */}
          <div className="rounded-xl border border-border-default bg-surface overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowPnL(!showPnL)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowPnL((prev) => !prev);
                }
              }}
              className="flex items-center justify-between w-full p-5 hover:bg-surface-secondary transition-colors cursor-pointer"
            >
              <h3 className="text-sm font-medium text-text-primary">
                Profit & Loss Report
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadCSV();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
                {isPro && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintPdf();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                )}
                {showPnL ? (
                  <ChevronDown className="h-4 w-4 text-text-tertiary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                )}
              </div>
            </div>

            {showPnL && pnl && (
              <div className="border-t border-border-default p-5 space-y-6">
                <div ref={printableRef} className="space-y-6">
                  {/* Income section */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                      Income
                    </h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-text-tertiary text-xs uppercase border-b border-border-default">
                          <th className="text-left py-2">Month</th>
                          <th className="text-right py-2">Invoices</th>
                          <th className="text-right py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnl.income.map((row) => (
                          <tr
                            key={row.month}
                            className="border-b border-border-default/50"
                          >
                            <td className="py-2 text-text-primary">
                              {formatMonth(row.month)}
                            </td>
                            <td className="py-2 text-right text-text-secondary">
                              {row.invoices}
                            </td>
                            <td className="py-2 text-right font-medium text-text-primary">
                              {formatCurrencyCompact(row.total, baseCurrency)}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td className="py-2 text-text-primary">
                            TOTAL INCOME
                          </td>
                          <td className="py-2 text-right text-text-secondary" />
                          <td className="py-2 text-right text-text-primary">
                            {formatCurrencyCompact(
                              pnl.summary.totalIncome,
                              baseCurrency,
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Expenses section */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                      Expenses by Category
                    </h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-text-tertiary text-xs uppercase border-b border-border-default">
                          <th className="text-left py-2">Category</th>
                          <th className="text-right py-2">Items</th>
                          <th className="text-right py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnl.expenses.map((row) => (
                          <tr
                            key={row.category}
                            className="border-b border-border-default/50"
                          >
                            <td className="py-2 text-text-primary">
                              {row.category}
                            </td>
                            <td className="py-2 text-right text-text-secondary">
                              {row.items}
                            </td>
                            <td className="py-2 text-right text-text-primary">
                              {formatCurrencyCompact(row.total, baseCurrency)}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td className="py-2 text-text-primary">
                            TOTAL EXPENSES
                          </td>
                          <td className="py-2 text-right text-text-secondary" />
                          <td className="py-2 text-right text-text-primary">
                            {formatCurrencyCompact(
                              pnl.summary.totalExpenses,
                              baseCurrency,
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="border-t border-border-default pt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Net Profit</span>
                      <span className="font-semibold text-text-primary">
                        {formatCurrencyCompact(
                          pnl.summary.netProfit,
                          baseCurrency,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">
                        Estimated Tax ({(pnl.summary.taxRate * 100).toFixed(0)}
                        %)
                      </span>
                      <span className="font-semibold text-[var(--warning)]">
                        {formatCurrencyCompact(pnl.summary.estimatedTax)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Set my tax rate link */}
          <div className="text-center">
            <Link
              href="/settings"
              className="text-sm text-accent underline hover:text-text-primary transition-colors"
            >
              Set my tax rate in Settings
            </Link>
          </div>

          {/* Disclaimer */}
          <div className="rounded-xl border border-[var(--warning-muted)] bg-[var(--warning-muted)]/10 p-4">
            <p className="text-sm text-[var(--warning)]">
              This is an estimate only and is not tax advice. Consult a
              qualified accountant before filing.
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-secondary">
          Failed to load tax estimate.
        </p>
      )}
    </div>
  );
}

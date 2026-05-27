"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Receipt, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import toast from "react-hot-toast";
import { formatCurrency, SUPPORTED_CURRENCIES, currenciesWithSymbol } from "@/lib/format-currency";

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  vendor: string | null;
  categoryId: string | null;
  category: Category | null;
  taxDeductible: boolean;
  receiptUrl: string | null;
  notes: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ExpensesClient({
  expenses: initialExpenses,
  total,
  categories,
  currentMonth,
}: {
  expenses: Expense[];
  total: number;
  categories: Category[];
  currentMonth: string;
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    description: "",
    amount: "",
    currency: "USD",
    date: new Date().toISOString().split("T")[0],
    vendor: "",
    categoryId: "",
    taxDeductible: true,
    notes: "",
  });

  const resetForm = () => {
    setForm({
      description: "",
      amount: "",
      currency: "USD",
      date: new Date().toISOString().split("T")[0],
      vendor: "",
      categoryId: "",
      taxDeductible: true,
      notes: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const fetchMonth = useCallback(async (m: string) => {
    const res = await fetch(`/api/expenses?month=${m}`);
    if (!res.ok) return;
    const data = await res.json();
    setExpenses(data.expenses);
    setMonth(m);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      currency: form.currency,
      vendor: form.vendor || undefined,
      categoryId: form.categoryId || undefined,
      notes: form.notes || undefined,
    };

    const url = editingId ? `/api/expenses/${editingId}` : "/api/expenses";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(Object.values(err.error || {}).flat().join(", ") || "Failed to save");
        return;
      }

      toast.success(editingId ? "Expense updated" : "Expense added");
      resetForm();
      fetchMonth(month);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setForm({
      description: expense.description,
      amount: expense.amount.toString(),
      currency: expense.currency,
      date: expense.date,
      vendor: expense.vendor || "",
      categoryId: expense.categoryId || "",
      taxDeductible: expense.taxDeductible,
      notes: expense.notes || "",
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;

    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }

    toast.success("Expense deleted");
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    router.refresh();
  };

  const monthPicker = (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={(e) => fetchMonth(e.target.value)}
        className="rounded-lg border border-border-default bg-surface px-3 py-1.5 text-sm text-text-primary"
      >
        {Array.from({ length: 12 }, (_, i) => {
          const now = new Date();
          const m = new Date(now.getFullYear(), i, 1);
          const val = `${m.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
          return (
            <option key={val} value={val}>
              {MONTH_NAMES[i]} {m.getFullYear()}
            </option>
          );
        })}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {monthPicker}
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border-default bg-surface p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">
              {editingId ? "Edit Expense" : "New Expense"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Description *</label>
              <input
                required
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary"
                placeholder="e.g. Adobe Creative Cloud"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">
                  {formatCurrency(0, form.currency).charAt(0)}
                </span>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary pl-7 pr-3 py-2 text-sm text-text-primary placeholder-text-tertiary"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
              >
                {currenciesWithSymbol().map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Date *</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Vendor</label>
              <input
                value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary"
                placeholder="e.g. Amazon, Adobe"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.taxDeductible}
                  onChange={(e) => setForm((f) => ({ ...f, taxDeductible: e.target.checked }))}
                  className="rounded border-border-default"
                />
                <span className="text-sm text-text-secondary">Tax deductible</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={resetForm}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update" : "Save"}
            </Button>
          </div>
        </form>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Start tracking your spending by adding an expense."
          action={showForm ? undefined : { label: "Add Expense", onClick: () => setShowForm(true) }}
        >
          <Receipt className="h-12 w-12 text-text-tertiary" />
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Tax Deductible</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-sm text-text-secondary">
                    {expense.date}
                  </TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {expense.description}
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {expense.vendor || "-"}
                  </TableCell>
                  <TableCell>
                    {expense.category ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs text-text-secondary">
                        {expense.category.name}
                      </span>
                    ) : (
                      <span className="text-sm text-text-tertiary">Uncategorised</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {formatCurrency(expense.amount, expense.currency)}
                  </TableCell>
                  <TableCell>
                    {expense.taxDeductible ? (
                      <span className="text-xs text-[var(--success)]">Yes</span>
                    ) : (
                      <span className="text-xs text-text-tertiary">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-[var(--danger)] hover:bg-surface-tertiary transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <p className="text-xs text-text-tertiary text-center">
          Showing {expenses.length} of {total} expense{total !== 1 ? "s" : ""} this month
        </p>
      )}
    </div>
  );
}

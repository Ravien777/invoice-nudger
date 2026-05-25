"use client";

import { useState } from "react";
import { Plus, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Badge, type BadgeVariant } from "@/app/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import toast from "react-hot-toast";

interface RecurringItem {
  id: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  frequency: string;
  dayOfMonth: number | null;
  nextRunDate: string;
  endDate: string | null;
  description: string | null;
  status: string;
  autoSend: boolean;
  invoicesCreated: number;
  lastRunDate: string | null;
  createdAt: string;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

const FREQ_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const currencySymbols: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$",
  SGD: "S$", ZAR: "R", INR: "₹", JPY: "¥", CHF: "Fr",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  active: "active",
  paused: "paused",
  cancelled: "cancelled",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDefaultNextRun(frequency: string, dayOfMonth?: number): string {
  const now = new Date();
  switch (frequency) {
    case "weekly": {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return d.toISOString().split("T")[0];
    }
    case "biweekly": {
      const d = new Date(now);
      d.setDate(d.getDate() + 14);
      return d.toISOString().split("T")[0];
    }
    case "monthly": {
      const d = new Date(now);
      const target = Math.min(dayOfMonth ?? 1, 28);
      if (d.getDate() < target) {
        d.setDate(target);
      } else {
        d.setMonth(d.getMonth() + 1);
        d.setDate(target);
      }
      return d.toISOString().split("T")[0];
    }
    case "quarterly": {
      const d = new Date(now);
      d.setDate(d.getDate() + 90);
      return d.toISOString().split("T")[0];
    }
    case "annually": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split("T")[0];
    }
    default:
      return now.toISOString().split("T")[0];
  }
}

export default function RecurringClient({ initial }: { initial: RecurringItem[] }) {
  const [items, setItems] = useState<RecurringItem[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    amount: "",
    currency: "USD",
    frequency: "monthly",
    dayOfMonth: "1",
    nextRunDate: getDefaultNextRun("monthly", 1),
    endDate: "",
    description: "",
    autoSend: true,
  });

  const needsDay = form.frequency === "monthly" || form.frequency === "quarterly" || form.frequency === "annually";

  const handleFrequencyChange = (freq: string) => {
    const day = form.dayOfMonth || "1";
    setForm({
      ...form,
      frequency: freq,
      nextRunDate: getDefaultNextRun(freq, Number(day)),
    });
  };

  const handleDayChange = (day: string) => {
    setForm({
      ...form,
      dayOfMonth: day,
      nextRunDate: getDefaultNextRun(form.frequency, Number(day) || 1),
    });
  };

  const resetForm = () => {
    setForm({
      clientName: "",
      clientEmail: "",
      amount: "",
      currency: "USD",
      frequency: "monthly",
      dayOfMonth: "1",
      nextRunDate: getDefaultNextRun("monthly", 1),
      endDate: "",
      description: "",
      autoSend: true,
    });
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          dayOfMonth: needsDay ? Number(form.dayOfMonth) : undefined,
          endDate: form.endDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.fieldErrors ? Object.values(err.error.fieldErrors).flat().join(", ") : "Failed to create");
        return;
      }
      const created = await res.json();
      setItems([created, ...items]);
      resetForm();
      toast.success("Recurring invoice created");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: RecurringItem, newStatus: string) => {
    const res = await fetch(`/api/recurring/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: item.clientName,
        clientEmail: item.clientEmail,
        amount: item.amount,
        currency: item.currency,
        frequency: item.frequency,
        dayOfMonth: item.dayOfMonth ?? undefined,
        nextRunDate: item.nextRunDate,
        endDate: item.endDate || undefined,
        description: item.description || "",
        autoSend: item.autoSend,
      }),
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    const updated = await res.json();
    setItems(items.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
    toast.success(newStatus === "active" ? "Resumed" : "Paused");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    setItems(items.filter((i) => i.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="space-y-6">
      {showForm ? (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border-default bg-surface p-5 space-y-4">
          <h3 className="text-sm font-medium text-text-primary">New Recurring Invoice</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Client Name *</label>
              <input
                type="text"
                required
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Client Email *</label>
              <input
                type="email"
                required
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="SGD">SGD (S$)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Frequency *</label>
              <select
                value={form.frequency}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
              >
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {needsDay && (
              <div>
                <label className="block text-xs text-text-secondary mb-1">Day of Month (1–28)</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={form.dayOfMonth}
                  onChange={(e) => handleDayChange(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-text-secondary mb-1">First Invoice Date *</label>
              <input
                type="date"
                required
                value={form.nextRunDate}
                onChange={(e) => setForm({ ...form, nextRunDate: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">End Date (optional)</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Description (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.autoSend}
              onChange={(e) => setForm({ ...form, autoSend: e.target.checked })}
              className="rounded border-border-default"
            />
            Send automatically (creates invoice as unpaid)
          </label>

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>Create</Button>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4" />
            Set Up Recurring Invoice
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            No recurring invoices yet. Set one up for retainer clients.
          </p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Next Invoice</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Status</TableCell>
              <TableCell className="text-right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const sym = currencySymbols[item.currency] || item.currency;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium text-text-primary">{item.clientName}</span>
                    <span className="text-text-tertiary text-xs block">{item.clientEmail}</span>
                  </TableCell>
                  <TableCell className="font-medium text-text-primary">{sym}{item.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-text-secondary">{FREQ_LABELS[item.frequency] || item.frequency}</TableCell>
                  <TableCell className="text-text-secondary">{formatDate(item.nextRunDate)}</TableCell>
                  <TableCell className="text-text-secondary">{item.invoicesCreated}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[item.status] || "neutral"}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.status === "active" ? (
                        <button
                          onClick={() => toggleStatus(item, "paused")}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                          title="Pause"
                        >
                          <Pause className="h-3.5 w-3.5" />
                        </button>
                      ) : item.status === "paused" ? (
                        <button
                          onClick={() => toggleStatus(item, "active")}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                          title="Resume"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-[var(--danger)] hover:bg-surface-tertiary transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { Plus, Pause, Play, Trash2, Pencil } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Badge, type BadgeVariant } from "@/app/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { Select } from "@/app/components/ui/Select";
import toast from "react-hot-toast";
import { formatCurrency, currencySymbol, currenciesWithSymbol } from "@/lib/format-currency";

interface Schedule {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface LineItemData {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  total: number;
  sortOrder: number;
}

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
  lineItems: LineItemData[] | null;
  status: string;
  autoSend: boolean;
  reminderScheduleId: string | null;
  invoicesCreated: number;
  lastRunDate: string | null;
  createdAt: string;
}

interface LineItemForm {
  tempId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
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

export default function RecurringClient({ initial, schedules, baseCurrency = "USD" }: { initial: RecurringItem[]; schedules: Schedule[]; baseCurrency?: string }) {
  const [items, setItems] = useState<RecurringItem[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    amount: "",
    currency: baseCurrency,
    frequency: "monthly",
    dayOfMonth: "1",
    nextRunDate: getDefaultNextRun("monthly", 1),
    endDate: "",
    description: "",
    autoSend: true,
    reminderScheduleId: "",
  });

  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);

  const needsDay = form.frequency === "monthly" || form.frequency === "quarterly";

  const lineItemIdx = useRef(0);
  const addLineItem = () => {
    setLineItems([...lineItems, { tempId: `item_${++lineItemIdx.current}`, description: "", quantity: "", unitPrice: "", taxRate: "" }]);
  };

  const removeLineItem = (tempId: string) => {
    setLineItems(lineItems.filter((li) => li.tempId !== tempId));
  };

  const updateLineItem = (tempId: string, field: keyof Omit<LineItemForm, "tempId">, value: string) => {
    setLineItems(lineItems.map((li) => (li.tempId === tempId ? { ...li, [field]: value } : li)));
  };

  const computedLineItemTotal = lineItems.reduce((sum, li) => {
    const qty = parseFloat(li.quantity) || 0;
    const price = parseFloat(li.unitPrice) || 0;
    const tax = (parseFloat(li.taxRate) || 0) / 100;
    return sum + qty * price * (1 + tax);
  }, 0);

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
      currency: baseCurrency,
      frequency: "monthly",
      dayOfMonth: "1",
      nextRunDate: getDefaultNextRun("monthly", 1),
      endDate: "",
      description: "",
      autoSend: true,
      reminderScheduleId: "",
    });
    setLineItems([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/recurring/${editingId}` : "/api/recurring";
      const method = editingId ? "PUT" : "POST";
      const payloadLineItems = lineItems
        .filter((li) => li.description.trim())
        .map((li, i) => ({
          description: li.description,
          quantity: parseFloat(li.quantity) || 1,
          unitPrice: parseFloat(li.unitPrice) || 0,
          taxRate: parseFloat(li.taxRate) || undefined,
          total: (parseFloat(li.quantity) || 1) * (parseFloat(li.unitPrice) || 0) * (1 + ((parseFloat(li.taxRate) || 0) / 100)),
          sortOrder: i,
        }));
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          dayOfMonth: needsDay ? Number(form.dayOfMonth) : undefined,
          endDate: form.endDate || undefined,
          reminderScheduleId: form.reminderScheduleId || undefined,
          lineItems: payloadLineItems,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.fieldErrors ? Object.values(err.error.fieldErrors).flat().join(", ") : "Failed to save");
        return;
      }
      const saved = await res.json();
      if (editingId) {
        setItems(items.map((i) => (i.id === editingId ? { ...i, ...saved } : i)));
        toast.success("Recurring invoice updated");
      } else {
        setItems([saved, ...items]);
        toast.success("Recurring invoice created");
      }
      resetForm();
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
        reminderScheduleId: item.reminderScheduleId || undefined,
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

  const handleEdit = (item: RecurringItem) => {
    setForm({
      clientName: item.clientName,
      clientEmail: item.clientEmail,
      amount: item.amount.toString(),
      currency: item.currency,
      frequency: item.frequency,
      dayOfMonth: item.dayOfMonth?.toString() || "1",
      nextRunDate: item.nextRunDate.split("T")[0],
      endDate: item.endDate ? item.endDate.split("T")[0] : "",
      description: item.description || "",
      autoSend: item.autoSend,
      reminderScheduleId: item.reminderScheduleId || "",
    });
    if (item.lineItems) {
      setLineItems(item.lineItems.map((li) => ({
        tempId: `item_${li.sortOrder}`,
        description: li.description,
        quantity: li.quantity.toString(),
        unitPrice: li.unitPrice.toString(),
        taxRate: li.taxRate?.toString() || "",
      })));
    } else {
      setLineItems([]);
    }
    setEditingId(item.id);
    setShowForm(true);
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
          <h3 className="text-sm font-medium text-text-primary">{editingId ? "Edit Recurring Invoice" : "New Recurring Invoice"}</h3>

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
                {currenciesWithSymbol().map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Line Items</label>
              <Button type="button" variant="ghost" size="sm" onClick={addLineItem}>
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            </div>
            {lineItems.length > 0 && (
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-text-tertiary uppercase tracking-wider px-1">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2">Tax %</div>
                  <div className="col-span-1" />
                </div>
                {lineItems.map((li) => (
                  <div key={li.tempId} className="flex flex-col sm:grid sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <input
                        value={li.description}
                        onChange={(e) => updateLineItem(li.tempId, "description", e.target.value)}
                        placeholder="Description"
                        className="w-full rounded-lg border border-border-default bg-surface-secondary px-2 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
                      />
                    </div>
                    <div className="flex gap-2 sm:col-span-6">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(li.tempId, "quantity", e.target.value)}
                        placeholder="Qty"
                        className="flex-1 min-w-0 rounded-lg border border-border-default bg-surface-secondary px-2 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={li.unitPrice}
                        onChange={(e) => updateLineItem(li.tempId, "unitPrice", e.target.value)}
                        placeholder="Price"
                        className="flex-1 min-w-0 rounded-lg border border-border-default bg-surface-secondary px-2 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={li.taxRate}
                        onChange={(e) => updateLineItem(li.tempId, "taxRate", e.target.value)}
                        placeholder="Tax %"
                        className="flex-1 min-w-0 rounded-lg border border-border-default bg-surface-secondary px-2 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLineItem(li.tempId)}
                      className="self-start sm:self-auto p-1.5 rounded-md text-text-tertiary hover:text-[var(--danger)] hover:bg-surface-tertiary transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {lineItems.length > 0 && lineItems.some((li) => li.description.trim()) && (
              <div className="text-right text-sm text-text-secondary">
                Line items total: {formatCurrency(computedLineItemTotal, form.currency)}
              </div>
            )}
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

          {schedules.length > 0 && (
            <div>
              <label className="block text-xs text-text-secondary mb-1">Reminder Schedule</label>
              <Select
                value={form.reminderScheduleId}
                onChange={(e) => setForm({ ...form, reminderScheduleId: e.target.value })}
              >
                <option value="">Default schedule</option>
                {schedules
                  .filter((s) => !s.isDefault)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
              <p className="mt-1 text-xs text-text-tertiary">
                Leave as &quot;Default schedule&quot; to use your standard reminder settings.
              </p>
            </div>
          )}

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
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium text-text-primary">{item.clientName}</span>
                    <span className="text-text-tertiary text-xs block">{item.clientEmail}</span>
                  </TableCell>
                  <TableCell className="font-medium text-text-primary">{formatCurrency(item.amount, item.currency)}</TableCell>
                  <TableCell className="text-text-secondary">{FREQ_LABELS[item.frequency] || item.frequency}</TableCell>
                  <TableCell className="text-text-secondary">{formatDate(item.nextRunDate)}</TableCell>
                  <TableCell className="text-text-secondary">{item.invoicesCreated}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[item.status] || "neutral"}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
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

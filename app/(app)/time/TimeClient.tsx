"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format-currency";

interface TimeEntry {
  id: string;
  clientEmail: string;
  clientName: string | null;
  description: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  hourlyRate: number | null;
  invoiced: boolean;
  invoiceId: string | null;
}

interface ClientGroup {
  clientEmail: string;
  clientName: string | null;
  entries: TimeEntry[];
  totalMinutes: number;
  totalValue: number;
}

function fmtDur(minutes: number | null): string {
  if (minutes === null) return "\u2014";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function elapsed(s: string): string {
  const diff = Date.now() - new Date(s).getTime();
  const totalMin = Math.floor(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const sec = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export default function TimeClient({
  entries: initialEntries,
  activeEntry: initialActive,
  defaultHourlyRate,
  baseCurrency = "USD",
}: {
  entries: TimeEntry[];
  activeEntry: TimeEntry | null;
  defaultHourlyRate: number | null;
  baseCurrency?: string;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(initialActive);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedStr, setElapsedStr] = useState("");

  const [form, setForm] = useState({
    clientEmail: "",
    clientName: "",
    description: "",
    hourlyRate: defaultHourlyRate ? String(defaultHourlyRate) : "",
    currency: baseCurrency,
  });

  useEffect(() => {
    if (!activeEntry) return;
    setElapsedStr(elapsed(activeEntry.startTime));
    const interval = setInterval(() => {
      setElapsedStr(elapsed(activeEntry.startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const resetForm = () => {
    setForm({
      clientEmail: "",
      clientName: "",
      description: "",
      hourlyRate: defaultHourlyRate ? String(defaultHourlyRate) : "",
      currency: baseCurrency,
    });
    setShowForm(false);
  };

  const startTimer = async () => {
    if (!form.clientEmail) { toast.error("Client email is required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: form.clientEmail,
          clientName: form.clientName || undefined,
          description: form.description || undefined,
          hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
          currency: form.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start timer");
      setActiveEntry(data.entry);
      setEntries((prev) => [data.entry, ...prev]);
      resetForm();
      toast.success("Timer started");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const stopTimer = async (id: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/time/${id}/stop`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to stop timer");
      setActiveEntry(null);
      setEntries((prev) => prev.map((e) => (e.id === id ? data.entry : e)));
      toast.success("Timer stopped");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this time entry?")) return;
    try {
      const res = await fetch(`/api/time/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const unbilled = entries.filter((e) => !e.invoiced && e.endTime);

  const clientMap = new Map<string, ClientGroup>();
  for (const e of unbilled) {
    const key = e.clientEmail;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        clientEmail: key,
        clientName: e.clientName,
        entries: [],
        totalMinutes: 0,
        totalValue: 0,
      });
    }
    const g = clientMap.get(key)!;
    g.entries.push(e);
    g.totalMinutes += e.durationMinutes ?? 0;
    const rate = e.hourlyRate ?? defaultHourlyRate ?? 0;
    g.totalValue += ((e.durationMinutes ?? 0) / 60) * rate;
  }
  const groups = Array.from(clientMap.values()).sort((a, b) =>
    (a.clientName ?? a.clientEmail).localeCompare(b.clientName ?? b.clientEmail),
  );

  const createInvoice = async (clientEmail: string) => {
    const group = clientMap.get(clientEmail);
    const rate = group?.entries.find((e) => e.hourlyRate)?.hourlyRate ?? defaultHourlyRate;
    if (!rate) {
      toast.error("No hourly rate set. Set one in settings or override per entry.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/time/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEmail, hourlyRate: rate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create invoice");
      setEntries((prev) =>
        prev.map((e) =>
          e.clientEmail === clientEmail && !e.invoiced
            ? { ...e, invoiced: true, invoiceId: data.invoice.id }
            : e,
        ),
      );
      toast.success("Invoice created");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {activeEntry ? (
        <div className="rounded-xl border border-border-default bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-medium text-text-primary">
                {activeEntry.clientName ?? activeEntry.clientEmail}
              </p>
              {activeEntry.description && (
                <p className="text-xs text-text-tertiary">{activeEntry.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-mono font-bold tabular-nums text-text-primary">
                {elapsedStr || fmtDur(0)}
              </span>
              <Button variant="danger" size="sm" onClick={() => stopTimer(activeEntry.id)} disabled={submitting}>
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {!showForm ? (
            <Button onClick={() => setShowForm(true)}>
              <Play className="h-4 w-4 mr-2" />
              Start Timer
            </Button>
          ) : (
            <div className="rounded-xl border border-border-default bg-surface p-6 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Client Email *</label>
                  <input
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus"
                    placeholder="client@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Client Name</label>
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus"
                    placeholder="Website redesign"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Hourly Rate</label>
                  <input
                    type="number"
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus"
                    placeholder={String(defaultHourlyRate ?? "75")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full rounded-lg border border-border-default bg-canvas px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
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
              </div>
              <div className="flex gap-2">
                <Button onClick={startTimer} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                  Start
                </Button>
                <Button variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="No unbilled time entries"
          description="Start a timer to track your hours."
        />
      ) : (
        groups.map((g) => (
          <div key={g.clientEmail} className="rounded-xl border border-border-default bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-canvas">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {g.clientName ?? g.clientEmail}
                </h3>
                <p className="text-xs text-text-tertiary">{g.entries.length} entr{g.entries.length === 1 ? "y" : "ies"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-text-primary">{fmtDur(g.totalMinutes)}</p>
                <p className="text-xs font-semibold text-text-primary">
                  {formatCurrency(Math.round(g.totalValue * 100) / 100, baseCurrency)}
                </p>
              </div>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Rate</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {g.entries.map((entry) => {
                  const rate = entry.hourlyRate ?? defaultHourlyRate ?? 0;
                  const value = ((entry.durationMinutes ?? 0) / 60) * rate;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {new Date(entry.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell className="text-text-primary">{entry.description ?? "\u2014"}</TableCell>
                      <TableCell className="font-mono">{fmtDur(entry.durationMinutes)}</TableCell>
                      <TableCell>{rate ? formatCurrency(rate, baseCurrency) : "\u2014"}</TableCell>
                      <TableCell>{formatCurrency(Math.round(value * 100) / 100, baseCurrency)}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-end px-6 py-3 border-t border-border-default bg-canvas">
              <Button size="sm" onClick={() => createInvoice(g.clientEmail)} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                Create Invoice
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

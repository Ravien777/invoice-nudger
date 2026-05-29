"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Plus, Download } from "lucide-react";
import { PageShell } from "@/app/components/layout/PageShell";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import { Modal } from "@/app/components/ui/Modal";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { formatCurrency } from "@/lib/format-currency";

interface Contractor {
  id: string;
  name: string;
  email: string;
  role: string | null;
  rate: number | null;
  rateType: string | null;
  taxId: string | null;
  _count: { payments: number };
}

interface Payment {
  id: string;
  contractorId: string;
  contractor: { name: string };
  amount: number;
  currency: string;
  description: string;
  paymentDate: string;
  payslipUrl: string | null;
  expenseId: string | null;
  createdAt: string;
}

interface BusinessProfile {
  businessName: string | null;
  businessAddress: string | null;
}

interface PayrollClientProps {
  contractors: Contractor[];
  payments: Payment[];
  businessProfile: BusinessProfile | null;
  userPlan: string;
}

type Tab = "contractors" | "payments";

export default function PayrollClient({
  contractors: initialContractors,
  payments: initialPayments,
  businessProfile,
  userPlan,
}: PayrollClientProps) {
  const [tab, setTab] = useState<Tab>("contractors");
  const [contractors, setContractors] = useState(initialContractors);
  const [payments, setPayments] = useState(initialPayments);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAgency = userPlan === "agency";

  // Add contractor form
  const [newContractor, setNewContractor] = useState({
    name: "",
    email: "",
    role: "",
    rate: "",
    rateType: "hourly",
    taxId: "",
  });

  // Pay form
  const [payForm, setPayForm] = useState({
    amount: "",
    currency: "USD",
    description: "",
    paymentDate: new Date().toISOString().slice(0, 10),
  });

  const resetNewContractor = () =>
    setNewContractor({ name: "", email: "", role: "", rate: "", rateType: "hourly", taxId: "" });

  const resetPayForm = () =>
    setPayForm({ amount: "", currency: "USD", description: "", paymentDate: new Date().toISOString().slice(0, 10) });

  const handleAddContractor = useCallback(async () => {
    if (!newContractor.name || !newContractor.email) {
      toast.error("Name and email are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContractor.name,
          email: newContractor.email,
          role: newContractor.role || null,
          rate: newContractor.rate ? parseFloat(newContractor.rate) : null,
          rateType: newContractor.rateType || null,
          taxId: newContractor.taxId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error?.name?.[0] || data.error?.email?.[0] || "Failed to add contractor");
        return;
      }

      const contractor = await res.json();
      setContractors((prev) => [contractor, ...prev]);
      toast.success("Contractor added");
      setAddModalOpen(false);
      resetNewContractor();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }, [newContractor]);

  const handleRecordPayment = useCallback(async () => {
    if (!selectedContractorId) return;
    if (!payForm.amount || !payForm.description) {
      toast.error("Amount and description are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contractors/${selectedContractorId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payForm.amount),
          currency: payForm.currency,
          description: payForm.description,
          paymentDate: payForm.paymentDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const msg = typeof data.error === "string" ? data.error : "Failed to record payment";
        toast.error(msg);
        return;
      }

      const result = await res.json();
      setPayments((prev) => [
        {
          id: result.paymentId,
          contractorId: selectedContractorId,
          contractor: { name: contractors.find((c) => c.id === selectedContractorId)?.name ?? "" },
          amount: parseFloat(payForm.amount),
          currency: payForm.currency,
          description: payForm.description,
          paymentDate: payForm.paymentDate,
          payslipUrl: result.payslipUrl,
          expenseId: result.expenseId,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setContractors((prev) =>
        prev.map((c) =>
          c.id === selectedContractorId
            ? { ...c, _count: { payments: c._count.payments + 1 } }
            : c,
        ),
      );
      toast.success("Payment recorded");
      setPayModalOpen(false);
      resetPayForm();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }, [selectedContractorId, payForm, contractors]);

  const handleDeleteContractor = useCallback(async (id: string) => {
    if (!confirm("Delete this contractor?")) return;

    try {
      const res = await fetch(`/api/contractors/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
        return;
      }
      setContractors((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contractor deleted");
    } catch {
      toast.error("Network error");
    }
  }, []);

  if (!isAgency) {
    return (
      <PageShell title="Payroll" subtitle="Pay your contractors and keep a record.">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-base font-medium text-text-secondary">Upgrade to Agency</h3>
          <p className="text-sm text-text-tertiary mt-1 max-w-xs">
            Contractor payroll is available on the Agency plan.
          </p>
        </div>
      </PageShell>
    );
  }

  const thisYearTotal = payments
    .filter((p) => new Date(p.paymentDate).getFullYear() === new Date().getFullYear())
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <PageShell
      title="Payroll"
      subtitle="Pay your contractors and keep a record. Simple payslips, no tax headaches."
    >
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setTab("contractors")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === "contractors"
              ? "bg-accent text-white"
              : "bg-surface-tertiary text-text-secondary hover:text-text-primary"
          }`}
        >
          Contractors
        </button>
        <button
          onClick={() => setTab("payments")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === "payments"
              ? "bg-accent text-white"
              : "bg-surface-tertiary text-text-secondary hover:text-text-primary"
          }`}
        >
          Payment History
        </button>
        <div className="flex-1" />
        <span className="text-sm text-text-tertiary">
          Total this year: {formatCurrency(thisYearTotal, "USD")}
        </span>
      </div>

      {tab === "contractors" && (
        <>
          <div className="mb-4">
            <Button onClick={() => { resetNewContractor(); setAddModalOpen(true); }} size="sm">
              <Plus className="h-4 w-4" />
              Add Contractor
            </Button>
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell hideBelow="sm">Role</TableCell>
                <TableCell hideBelow="sm">Rate</TableCell>
                <TableCell>Payments</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contractors.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-text-primary">{c.name}</TableCell>
                  <TableCell className="text-text-secondary">{c.email}</TableCell>
                  <TableCell hideBelow="sm" className="text-text-secondary">{c.role ?? "—"}</TableCell>
                  <TableCell hideBelow="sm" className="text-text-secondary">
                    {c.rate ? `${formatCurrency(c.rate, "USD")}${c.rateType === "hourly" ? "/hr" : c.rateType === "monthly" ? "/mo" : ""}` : "—"}
                  </TableCell>
                  <TableCell>{c._count.payments}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-accent"
                        title="Record Payment"
                        onClick={() => {
                          setSelectedContractorId(c.id);
                          resetPayForm();
                          setPayModalOpen(true);
                        }}
                      >
                        Pay
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        title="Delete"
                        onClick={() => handleDeleteContractor(c.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {contractors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-tertiary py-8">
                    No contractors yet. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}

      {tab === "payments" && (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Contractor</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Payslip</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-text-secondary">
                  {new Date(p.paymentDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </TableCell>
                <TableCell className="font-medium text-text-primary">{p.contractor.name}</TableCell>
                <TableCell className="text-text-secondary">{p.description}</TableCell>
                <TableCell className="font-medium text-text-primary">
                  {formatCurrency(p.amount, p.currency)}
                </TableCell>
                <TableCell>
                  {p.payslipUrl ? (
                    <a
                      href={p.payslipUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  ) : (
                    <span className="text-xs text-text-tertiary">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-tertiary py-8">
                  No payments recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Add Contractor Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Contractor"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddContractor} loading={submitting}>Add</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Name *</label>
            <Input
              value={newContractor.name}
              onChange={(e) => setNewContractor((p) => ({ ...p, name: e.target.value }))}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Email *</label>
            <Input
              type="email"
              value={newContractor.email}
              onChange={(e) => setNewContractor((p) => ({ ...p, email: e.target.value }))}
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Role</label>
            <Input
              value={newContractor.role}
              onChange={(e) => setNewContractor((p) => ({ ...p, role: e.target.value }))}
              placeholder="e.g. Designer, Developer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Rate</label>
              <Input
                type="number"
                step="0.01"
                value={newContractor.rate}
                onChange={(e) => setNewContractor((p) => ({ ...p, rate: e.target.value }))}
                placeholder="100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Rate type</label>
              <Select
                value={newContractor.rateType}
                onChange={(e) => setNewContractor((p) => ({ ...p, rateType: e.target.value }))}
              >
                <option value="hourly">Hourly</option>
                <option value="project">Project</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Tax ID</label>
            <Input
              value={newContractor.taxId}
              onChange={(e) => setNewContractor((p) => ({ ...p, taxId: e.target.value }))}
              placeholder="SSN, EIN, or VAT number"
            />
          </div>
        </div>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Record Payment"
        description={
          selectedContractorId
            ? `Recording payment for ${contractors.find((c) => c.id === selectedContractorId)?.name ?? "contractor"}`
            : undefined
        }
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPayModalOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} loading={submitting}>Record Payment</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Amount *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={payForm.amount}
              onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="500.00"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Currency</label>
            <Select
              value={payForm.currency}
              onChange={(e) => setPayForm((p) => ({ ...p, currency: e.target.value }))}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Description *</label>
            <Input
              value={payForm.description}
              onChange={(e) => setPayForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What was this payment for?"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Payment date</label>
            <Input
              type="date"
              value={payForm.paymentDate}
              onChange={(e) => setPayForm((p) => ({ ...p, paymentDate: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}

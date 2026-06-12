"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/Button";
import { Select } from "@/app/components/ui/Select";
import toast from "react-hot-toast";

interface Installment {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  stripePaymentIntentId: string | null;
}

interface PaymentPlan {
  id: string;
  invoiceId: string;
  status: string;
  installments: number;
  intervalDays: number;
  totalAmount: number;
  currency: string;
  installmentsList: Installment[];
}

function InstallmentTimeline({ installments }: { installments: Installment[] }) {
  const paid = installments.filter((i) => i.status === "paid").length;
  const total = installments.length;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-primary">
        Progress: {paid} of {total} installments paid
      </p>
      <div className="flex gap-1">
        {installments.map((inst, idx) => {
          let bg: string;
          if (inst.status === "paid") bg = "bg-success";
          else if (inst.status === "failed") bg = "bg-danger";
          else if (new Date(inst.dueDate) <= new Date()) bg = "bg-warning";
          else bg = "bg-surface-tertiary";

          return (
            <div
              key={inst.id}
              className={`h-2 flex-1 rounded-full ${bg}`}
              title={`#${idx + 1}: ${inst.status} (${new Date(inst.dueDate).toLocaleDateString()})`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs text-text-secondary">
        {installments.map((inst, idx) => (
          <div
            key={inst.id}
            className="flex items-center justify-between rounded border border-border-default p-2"
          >
            <span>
              #{idx + 1} — {new Date(inst.dueDate).toLocaleDateString()}
            </span>
            <span
              className={
                inst.status === "paid"
                  ? "text-success"
                  : inst.status === "failed"
                    ? "text-danger"
                    : "text-text-tertiary"
              }
            >
              {inst.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaymentPlanSection({
  invoiceId,
  hasPaymentMethod,
}: {
  invoiceId: string;
  hasPaymentMethod: boolean;
}) {
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState("2");
  const [intervalDays, setIntervalDays] = useState("30");

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-plan`);
      const data = await res.json();
      setPlan(data.plan ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  async function createPlan() {
    const res = await fetch(`/api/invoices/${invoiceId}/payment-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installments: parseInt(installments),
        intervalDays: parseInt(intervalDays),
      }),
    });

    if (res.ok) {
      toast.success("Payment plan created");
      loadPlan();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to create payment plan");
    }
  }

  async function cancelPlan() {
    const res = await fetch(`/api/invoices/${invoiceId}/payment-plan`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Payment plan cancelled");
      loadPlan();
    } else {
      toast.error("Failed to cancel payment plan");
    }
  }

  async function modifyPlan() {
    const res = await fetch(`/api/invoices/${invoiceId}/payment-plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installments: parseInt(installments),
        intervalDays: parseInt(intervalDays),
      }),
    });

    if (res.ok) {
      toast.success("Payment plan updated");
      loadPlan();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to update payment plan");
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <div className="h-20 rounded-lg bg-surface-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">
        Payment Plan
        {plan && (
          <span
            className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              plan.status === "active"
                ? "bg-success/10 text-success"
                : plan.status === "paused"
                  ? "bg-warning/10 text-warning"
                  : "bg-surface-tertiary text-text-tertiary"
            }`}
          >
            {plan.status}
          </span>
        )}
      </h2>

      {plan ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-text-secondary">Installments</p>
              <p className="font-medium text-text-primary">{plan.installments}</p>
            </div>
            <div>
              <p className="text-text-secondary">Interval</p>
              <p className="font-medium text-text-primary">
                {plan.intervalDays === 7
                  ? "Weekly"
                  : plan.intervalDays === 14
                    ? "Biweekly"
                    : "Monthly"}
              </p>
            </div>
          </div>

          <InstallmentTimeline installments={plan.installmentsList} />

          {plan.status === "active" && (
            <div className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Select value={installments} onChange={(e) => setInstallments(e.target.value)}>
                  <option value="2">2 installments</option>
                  <option value="3">3 installments</option>
                  <option value="4">4 installments</option>
                  <option value="6">6 installments</option>
                  <option value="12">12 installments</option>
                </Select>
                <Select value={String(intervalDays)} onChange={(e) => setIntervalDays(e.target.value)}>
                  <option value="7">Weekly</option>
                  <option value="14">Biweekly</option>
                  <option value="30">Monthly</option>
                </Select>
                <Button variant="secondary" size="sm" onClick={modifyPlan}>
                  Modify
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelPlan}>
                Cancel Plan
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {!hasPaymentMethod ? (
            <p className="text-sm text-text-secondary">
              This client needs a saved payment method before setting up a payment plan.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Select value={installments} onChange={(e) => setInstallments(e.target.value)}>
                  <option value="2">2 installments</option>
                  <option value="3">3 installments</option>
                  <option value="4">4 installments</option>
                  <option value="6">6 installments</option>
                  <option value="12">12 installments</option>
                </Select>
                <Select value={String(intervalDays)} onChange={(e) => setIntervalDays(e.target.value)}>
                  <option value="7">Weekly</option>
                  <option value="14">Biweekly</option>
                  <option value="30">Monthly</option>
                </Select>
              </div>
              <Button onClick={createPlan}>
                Create Payment Plan
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

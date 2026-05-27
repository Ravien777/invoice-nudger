"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format-currency";

interface PayYourselfWidgetProps {
  available: number;
  baseCurrency: string;
  hasAccess: boolean;
}

export default function PayYourselfWidget({
  available,
  baseCurrency,
  hasAccess,
}: PayYourselfWidgetProps) {
  const [acknowledging, setAcknowledging] = useState(false);
  const [done, setDone] = useState(false);

  if (!hasAccess) return null;

  if (available <= 0 || done) return null;

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      const res = await fetch("/api/allocation/pay-yourself-acknowledge", {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to acknowledge");
        return;
      }
      toast.success("Paid yourself! 🎉");
      setDone(true);
    } catch {
      toast.error("Network error");
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
      <h2 className="text-sm font-medium text-text-secondary mb-1">
        Pay Yourself
      </h2>
      <p className="text-2xl font-bold text-text-primary mt-2">
        {formatCurrency(available, baseCurrency)}
      </p>
      <p className="text-xs text-text-tertiary mt-1">available to pay yourself</p>
      <button
        onClick={handleAcknowledge}
        disabled={acknowledging}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
      >
        {acknowledging ? "Saving..." : "Done, I paid myself"}
      </button>
    </div>
  );
}

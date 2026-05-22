"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { TIERS } from "@/lib/tiers";

const PRICE_IDS: Record<string, string> = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "",
  agency: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID || "",
};

interface BillingClientProps {
  user: {
    id: string;
    plan: string;
    subscriptionStatus: string | null;
    stripePriceId: string | null;
  };
  tier: {
    name: string;
    invoiceLimit: number | null;
    priceCents: number;
    features: string[];
  };
  monthlyInvoiceCount: number;
}

export default function BillingClient({ user, tier, monthlyInvoiceCount }: BillingClientProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(planKey: string) {
    const priceId = PRICE_IDS[planKey];
    if (!priceId) {
      toast.error("Price ID not configured");
      return;
    }

    setLoading(planKey);

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create checkout session");
        return;
      }

      window.location.href = data.url;
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  async function handleManageSubscription() {
    setLoading("manage");

    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create portal session");
        return;
      }

      window.location.href = data.url;
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  const usagePercent = tier.invoiceLimit
    ? Math.min((monthlyInvoiceCount / tier.invoiceLimit) * 100, 100)
    : 0;

  const isOverLimit = tier.invoiceLimit && monthlyInvoiceCount >= tier.invoiceLimit;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Billing</h1>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Current Plan: {tier.name}
            </h2>
            {user.subscriptionStatus && (
              <span
                className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  user.subscriptionStatus === "active"
                    ? "bg-[var(--success-muted)] text-[var(--success)]"
                    : user.subscriptionStatus === "past_due"
                    ? "bg-[var(--warning-muted)] text-[var(--warning)]"
                    : "bg-surface-muted text-muted"
                }`}
              >
                {user.subscriptionStatus}
              </span>
            )}
          </div>

          {user.subscriptionStatus === "active" && (
            <button
              onClick={handleManageSubscription}
              disabled={loading === "manage"}
              className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
            >
              {loading === "manage" ? "Loading..." : "Manage Subscription"}
            </button>
          )}
        </div>

        {tier.invoiceLimit !== null && (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">
                Monthly usage: {monthlyInvoiceCount} / {tier.invoiceLimit} invoices
              </span>
              <span className={`font-medium ${isOverLimit ? "text-[var(--danger)]" : "text-foreground"}`}>
                {Math.round(usagePercent)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverLimit ? "bg-[var(--danger)]" : usagePercent > 80 ? "bg-[var(--warning)]" : "bg-[var(--success)]"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {isOverLimit && (
              <p className="mt-2 text-sm text-[var(--danger)]">
                You've reached your invoice limit. Upgrade your plan to create more invoices.
              </p>
            )}
          </div>
        )}

        {tier.invoiceLimit === null && (
          <p className="text-sm text-muted">
            Unlimited invoices this month.
          </p>
        )}
      </div>

      <h2 className="mb-4 text-xl font-semibold text-foreground">
        Available Plans
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(TIERS).map(([key, t]) => {
          const isCurrentPlan = user.plan === key;

          return (
            <div
              key={key}
              className={`rounded-xl border p-6 shadow-sm transition ${
                isCurrentPlan
                  ? "border-[var(--accent)] bg-surface ring-2 ring-[var(--accent)]/20"
                  : "border-border bg-surface hover:shadow-md"
              }`}
            >
              {isCurrentPlan && (
                <span className="mb-3 inline-block rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-surface">
                  Current Plan
                </span>
              )}

              <h3 className="text-lg font-bold text-foreground">{t.name}</h3>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {t.priceCents === 0
                  ? "Free"
                  : `$${(t.priceCents / 100).toFixed(2)}`}
                {t.priceCents > 0 && (
                  <span className="text-sm font-normal text-muted">/mo</span>
                )}
              </p>

              <p className="mt-2 text-sm text-muted">
                {t.invoiceLimit === null
                  ? "Unlimited invoices"
                  : `${t.invoiceLimit} invoices per month`}
              </p>

              <ul className="mt-4 space-y-2">
                {t.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-muted">
                    <svg className="h-4 w-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full rounded-lg bg-surface-muted px-4 py-2 text-sm font-medium text-muted"
                  >
                    Current Plan
                  </button>
                ) : key === "free" ? (
                  <button
                    disabled
                    className="w-full rounded-lg bg-surface-muted px-4 py-2 text-sm font-medium text-muted"
                  >
                    Free Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={loading === key}
                    className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  >
                    {loading === key ? "Loading..." : "Upgrade"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { TIERS } from "@/lib/tiers";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import type { BadgeVariant } from "@/app/components/ui/Badge";

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

function subscriptionBadge(status: string | null): { label: string; variant: BadgeVariant } {
  if (status === "active") return { label: "Active", variant: "paid" };
  if (status === "past_due") return { label: "Past Due", variant: "overdue" };
  return { label: status ?? "Unknown", variant: "cancelled" };
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
  const badge = subscriptionBadge(user.subscriptionStatus);

  return (
    <div>
      {/* Current plan */}
      <div className="mb-8 rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              Current Plan: {tier.name}
            </h2>
            {user.subscriptionStatus && (
              <Badge variant={badge.variant}>{badge.label}</Badge>
            )}
          </div>

          {user.subscriptionStatus === "active" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleManageSubscription}
              loading={loading === "manage"}
            >
              Manage Subscription
            </Button>
          )}
        </div>

        {tier.invoiceLimit !== null ? (
          <div className="max-w-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                Monthly usage: {monthlyInvoiceCount} / {tier.invoiceLimit} invoices
              </span>
              <span className={`font-medium ${isOverLimit ? "text-danger" : "text-text-primary"}`}>
                {Math.round(usagePercent)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverLimit ? "bg-danger" : usagePercent > 80 ? "bg-warning" : "bg-success"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {isOverLimit && (
              <p className="mt-2 text-sm text-danger">
                You&apos;ve reached your invoice limit. Upgrade your plan to create more invoices.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Unlimited invoices this month.</p>
        )}
      </div>

      {/* Available Plans */}
      <h2 className="mb-4 text-xl font-semibold text-text-primary">
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
                  ? "border-accent bg-surface-secondary ring-2 ring-accent/20"
                  : "border-border-default bg-surface-secondary hover:shadow-md"
              }`}
            >
              {isCurrentPlan && (
                <span className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">
                  Current Plan
                </span>
              )}

              <h3 className="text-lg font-bold text-text-primary">{t.name}</h3>
              <p className="mt-1 text-2xl font-bold text-text-primary">
                {t.priceCents === 0
                  ? "Free"
                  : `$${(t.priceCents / 100).toFixed(2)}`}
                {t.priceCents > 0 && (
                  <span className="text-sm font-normal text-text-secondary">/mo</span>
                )}
              </p>

              <p className="mt-2 text-sm text-text-secondary">
                {t.invoiceLimit === null
                  ? "Unlimited invoices"
                  : `${t.invoiceLimit} invoices per month`}
              </p>

              <ul className="mt-4 space-y-2">
                {t.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrentPlan ? (
                  <Button variant="secondary" disabled className="w-full">
                    Current Plan
                  </Button>
                ) : key === "free" ? (
                  <Button variant="secondary" disabled className="w-full">
                    Free Plan
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => handleUpgrade(key)}
                    loading={loading === key}
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

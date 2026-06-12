"use client";

import { useState, useEffect } from "react";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/app/components/ui/Button";
import toast from "react-hot-toast";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

interface PaymentMethod {
  id: string;
  clientEmail: string;
  clientName: string | null;
  stripePaymentMethodId: string;
  isDefault: boolean;
  status: string;
  lastChargedAt: string | null;
  createdAt: string;
}

function SetupForm({
  clientEmail,
  clientName,
  onSuccess,
  onCancel,
}: {
  clientEmail: string;
  clientName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const res = await fetch("/api/clients/setup-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientEmail, clientName }),
    });

    const { clientSecret, setupIntentId, stripeCustomerId } = await res.json();

    if (!clientSecret) {
      toast.error("Failed to initialize payment setup");
      setLoading(false);
      return;
    }

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      clientSecret,
      redirect: "if_required",
    });

    if (error) {
      toast.error(error.message ?? "Setup failed");
      setLoading(false);
      return;
    }

    if (setupIntent?.status === "succeeded") {
      const paymentMethodId = setupIntent.payment_method as string;

      const saveRes = await fetch("/api/clients/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail,
          clientName,
          stripeCustomerId,
          stripePaymentMethodId: paymentMethodId,
          stripeSetupIntentId: setupIntent.id,
        }),
      });

      if (!saveRes.ok) {
        toast.error("Failed to save payment method");
        setLoading(false);
        return;
      }

      toast.success("Payment method saved");
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || loading}>
          {loading ? "Saving..." : "Save Card"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function AutoPaySection({
  clientEmail,
  clientName,
}: {
  clientEmail: string;
  clientName?: string;
}) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadMethods() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientEmail)}/payment-methods`);
      const data = await res.json();
      setMethods(data.paymentMethods ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMethods();
  }, [clientEmail]);

  async function removeMethod(id: string) {
    const res = await fetch(`/api/clients/payment-methods/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Payment method removed");
      loadMethods();
    } else {
      toast.error("Failed to remove payment method");
    }
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">Auto-Pay</h2>

      {loading ? (
        <div className="h-20 rounded-lg bg-surface-muted animate-pulse" />
      ) : methods.length > 0 ? (
        <div className="space-y-3">
          {methods.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-border-default bg-surface-primary p-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {m.isDefault ? "Default card" : "Saved card"}
                </p>
                <p className="text-xs text-text-tertiary">
                  ID: {m.stripePaymentMethodId.slice(0, 12)}...
                </p>
                {m.lastChargedAt && (
                  <p className="text-xs text-text-tertiary">
                    Last charged: {new Date(m.lastChargedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMethod(m.id)}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
            Add Another Card
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-text-secondary">
            No saved payment methods. Set up auto-pay to charge invoices automatically on the due date.
          </p>
          <Button onClick={() => setShowForm(true)}>
            Set Up Auto-Pay
          </Button>
        </div>
      )}

      {showForm && (
        <div className="mt-4 rounded-lg border border-border-default bg-surface-primary p-4">
          <Elements
            stripe={stripePromise}
            options={{
              mode: "setup",
              currency: "usd",
              appearance: { theme: "night" },
            } as StripeElementsOptions}
          >
            <SetupForm
              clientEmail={clientEmail}
              clientName={clientName}
              onSuccess={() => {
                setShowForm(false);
                loadMethods();
              }}
              onCancel={() => setShowForm(false)}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}

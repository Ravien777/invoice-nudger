"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import toast from "react-hot-toast";

const EVENT_OPTIONS = [
  { value: "invoice.created", label: "Invoice Created" },
  { value: "invoice.updated", label: "Invoice Updated" },
  { value: "invoice.deleted", label: "Invoice Deleted" },
  { value: "invoice.paid", label: "Invoice Paid" },
  { value: "invoice.overdue", label: "Invoice Overdue" },
  { value: "payment.received", label: "Payment Received" },
  { value: "expense.created", label: "Expense Created" },
  { value: "client.created", label: "Client Created" },
  { value: "client.updated", label: "Client Updated" },
];

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: string;
  lastDeliveredAt: string | null;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  status: string;
  responseCode: number | null;
  responseBody: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  attemptNumber: number;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  endpoint: { url: string };
}

export default function WebhookEndpointsSection({
  tier,
}: {
  tier: { webhookEndpointsLimit: number };
}) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["invoice.paid"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<string | null>(null);

  const loadEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/webhook-endpoints");
      const data = await res.json();
      setEndpoints(data.endpoints ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints]);

  const limit = tier.webhookEndpointsLimit;

  async function createEndpoint() {
    if (!url.trim()) return;
    if (selectedEvents.length === 0) {
      toast.error("Select at least one event");
      return;
    }

    const res = await fetch("/api/settings/webhook-endpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
    });

    if (res.ok) {
      const data = await res.json();
      setNewSecret(data.secret);
      setUrl("");
      setShowCreate(false);
      loadEndpoints();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to create endpoint");
    }
  }

  async function deleteEndpoint(id: string) {
    if (!confirm("Delete this webhook endpoint?")) return;
    const res = await fetch(`/api/settings/webhook-endpoints/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Webhook endpoint deleted");
      loadEndpoints();
    } else {
      toast.error("Failed to delete endpoint");
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function loadDeliveries(endpointId?: string) {
    setDeliveriesLoading(true);
    setDeliveryFilter(endpointId ?? null);
    try {
      const params = new URLSearchParams();
      if (endpointId) params.set("endpointId", endpointId);
      const res = await fetch(`/api/settings/webhook-endpoints/deliveries?${params}`);
      const data = await res.json();
      setDeliveries(data.deliveries ?? []);
      setShowDeliveries(true);
    } catch {
      toast.error("Failed to load delivery log");
    } finally {
      setDeliveriesLoading(false);
    }
  }

  const activeCount = endpoints.filter((e) => e.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Webhook Endpoints */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Webhook Endpoints
          {limit > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              ({activeCount}/{limit} used)
            </span>
          )}
        </h2>

        {limit === 0 ? (
          <p className="text-sm text-muted">
            Webhooks are not available on your plan.
          </p>
        ) : loading ? (
          <div className="h-20 rounded-lg bg-surface-muted animate-pulse" />
        ) : (
          <div className="space-y-3">
            {endpoints.length === 0 ? (
              <p className="text-sm text-muted">
                No webhook endpoints yet. Create one to receive event notifications.
              </p>
            ) : (
              endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-primary p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground break-all">{ep.url}</p>
                    <p className="text-xs text-muted mt-0.5">
                      Events: {ep.events.join(", ")}
                      {ep.lastDeliveredAt && ` — last delivery ${new Date(ep.lastDeliveredAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => loadDeliveries(ep.id)}>
                      Logs
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteEndpoint(ep.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}

            {activeCount < limit && (
              <div>
                {showCreate ? (
                  <div className="space-y-3 rounded-lg border border-border bg-surface-primary p-4">
                    <Input
                      placeholder="https://example.com/webhooks/maroni"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <div>
                      <p className="text-sm font-medium text-muted mb-2">Subscribe to events</p>
                      <div className="flex flex-wrap gap-2">
                        {EVENT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleEvent(opt.value)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                              selectedEvents.includes(opt.value)
                                ? "bg-accent text-surface"
                                : "bg-surface-muted text-muted hover:bg-surface-tertiary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createEndpoint} disabled={!url.trim() || selectedEvents.length === 0}>
                        Create Endpoint
                      </Button>
                      <Button variant="secondary" onClick={() => setShowCreate(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
                    Add Endpoint
                  </Button>
                )}
              </div>
            )}

            {newSecret && (
              <div className="rounded-lg border border-warning bg-warning/10 p-4">
                <p className="mb-2 text-sm font-medium text-warning">Save your webhook secret</p>
                <code className="block break-all rounded bg-surface-tertiary p-2 text-xs font-mono">
                  {newSecret}
                </code>
                <p className="mt-2 text-xs text-muted">
                  This secret will not be shown again. It is used to sign webhook payloads via the
                  X-Webhook-Signature header (HMAC-SHA256).
                </p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewSecret(null)}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delivery Log */}
      {showDeliveries && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Delivery Log</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowDeliveries(false)}>
              Close
            </Button>
          </div>

          {deliveries.length === 0 ? (
            <p className="text-sm text-muted">No deliveries yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-border bg-surface-primary p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${
                        d.status === "success" ? "text-[var(--success)]" : "text-[var(--error)]"
                      }`}
                    >
                      {d.event}
                    </span>
                    <span className="text-muted">
                      {d.status === "success" ? "✓" : "✗"} {d.responseCode ?? ""}
                      {d.durationMs != null && ` — ${d.durationMs}ms`}
                    </span>
                  </div>
                  <p className="text-muted mt-1 truncate">{d.endpoint.url}</p>
                  {d.errorMessage && <p className="text-[var(--error)] mt-1">{d.errorMessage}</p>}
                  {d.responseBody && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted">Response body</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-all bg-surface-muted p-2 rounded text-xs">
                        {d.responseBody}
                      </pre>
                    </details>
                  )}
                  <p className="text-muted mt-1">
                    {new Date(d.createdAt).toLocaleString()}
                    {d.nextRetryAt && ` — next retry: ${new Date(d.nextRetryAt).toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

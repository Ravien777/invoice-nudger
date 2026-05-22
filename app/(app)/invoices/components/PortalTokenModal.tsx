"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

interface Token {
  id: string;
  token: string;
  clientEmail: string;
  clientName: string | null;
  isActive: boolean;
  expiresAt: Date | null;
  lastAccessedAt: Date | null;
  createdAt: Date;
  portalUrl: string;
  isExpired: boolean;
}

interface PortalTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export default function PortalTokenModal({ isOpen, onClose, defaultEmail }: PortalTokenModalProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clientEmail, setClientEmail] = useState(defaultEmail || "");
  const [clientName, setClientName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/tokens");
      const data = await res.json();
      if (res.ok) {
        setTokens(data.tokens);
      }
    } catch {
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTokens();
    }
  }, [isOpen, loadTokens]);

  async function handleCreate() {
    if (!clientEmail.trim()) {
      toast.error("Client email is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/portal/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: clientEmail.trim(),
          clientName: clientName.trim() || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create token");
        return;
      }

      toast.success("Portal link created");
      setTokens((prev) => [
        {
          id: data.id,
          token: data.token,
          clientEmail: data.clientEmail,
          clientName: data.clientName,
          isActive: true,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          lastAccessedAt: null,
          createdAt: new Date(data.createdAt),
          portalUrl: data.portalUrl,
          isExpired: false,
        },
        ...prev,
      ]);
      setClientEmail("");
      setClientName("");
      setExpiresAt("");
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    try {
      const res = await fetch(`/api/portal/tokens/${tokenId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Failed to revoke token");
        return;
      }

      setTokens((prev) =>
        prev.map((t) => (t.id === tokenId ? { ...t, isActive: false } : t))
      );
      toast.success("Portal link revoked");
    } catch {
      toast.error("Network error");
    }
  }

  function handleCopy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Client Portal Links</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 rounded-lg border border-border bg-surface-muted p-4">
            <h3 className="mb-3 text-sm font-medium text-foreground">Create New Link</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted">Client Email *</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="block text-xs text-muted">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="John Doe"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="block text-xs text-muted">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Link"}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">Existing Links</h3>
            {loading ? (
              <p className="text-sm text-muted">Loading...</p>
            ) : tokens.length === 0 ? (
              <p className="text-sm text-muted">No portal links created yet.</p>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className={`rounded-lg border p-3 transition ${
                      !token.isActive || token.isExpired
                        ? "border-border bg-surface-muted opacity-60"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {token.clientName || token.clientEmail}
                          </p>
                          {!token.isActive && (
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">Revoked</span>
                          )}
                          {token.isExpired && (
                            <span className="rounded-full bg-[var(--danger-muted)] px-2 py-0.5 text-xs text-[var(--danger)]">Expired</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted">{token.clientEmail}</p>
                        <p className="mt-1 truncate text-xs text-muted">{token.portalUrl}</p>
                        <div className="mt-1 flex gap-3 text-xs text-muted">
                          <span>Created {new Date(token.createdAt).toLocaleDateString()}</span>
                          {token.expiresAt && (
                            <span>Expires {new Date(token.expiresAt).toLocaleDateString()}</span>
                          )}
                          {token.lastAccessedAt && (
                            <span>Accessed {new Date(token.lastAccessedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {token.isActive && !token.isExpired && (
                          <button
                            onClick={() => handleCopy(token.portalUrl, token.id)}
                            className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
                          >
                            {copiedId === token.id ? "Copied!" : "Copy"}
                          </button>
                        )}
                        {token.isActive && (
                          <button
                            onClick={() => handleRevoke(token.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-danger ring-1 ring-border transition hover:bg-surface-muted"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

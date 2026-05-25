"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Modal } from "@/app/components/ui/Modal";

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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Client Portal Links"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-6 rounded-lg border border-border-default bg-surface-tertiary p-4">
        <h3 className="mb-3 text-sm font-medium text-text-primary">Create New Link</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-text-secondary">Client Email *</label>
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary">Client Name</label>
            <Input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="John Doe"
              className="mt-1"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary">Expiry Date (optional)</label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleCreate}
              disabled={creating}
              loading={creating}
            >
              {creating ? "Creating..." : "Create Link"}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-text-primary">Existing Links</h3>
        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-text-secondary">No portal links created yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className={`rounded-lg border p-3 transition ${
                  !token.isActive || token.isExpired
                    ? "border-border-default bg-surface-tertiary opacity-60"
                    : "border-border-default bg-surface-secondary"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {token.clientName || token.clientEmail}
                      </p>
                      {!token.isActive && (
                        <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">Revoked</span>
                      )}
                      {token.isExpired && (
                        <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">Expired</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-text-secondary">{token.clientEmail}</p>
                    <p className="mt-1 truncate text-xs text-text-secondary">{token.portalUrl}</p>
                    <div className="mt-1 flex gap-3 text-xs text-text-secondary">
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopy(token.portalUrl, token.id)}
                      >
                        {copiedId === token.id ? "Copied!" : "Copy"}
                      </Button>
                    )}
                    {token.isActive && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevoke(token.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

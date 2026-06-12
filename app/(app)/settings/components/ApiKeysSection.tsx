"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import toast from "react-hot-toast";

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  status: string;
  createdAt: string;
}

export default function ApiKeysSection({ tier }: { tier: { apiKeysLimit: number } }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState("read");
  const [newKey, setNewKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  async function createKey() {
    if (!label.trim()) return;

    const res = await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), scopes }),
    });

    if (res.ok) {
      const data = await res.json();
      setNewKey(data.key);
      setLabel("");
      setShowCreate(false);
      loadKeys();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to create API key");
    }
  }

  async function revokeKey(id: string) {
    const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });

    if (res.ok) {
      toast.success("API key revoked");
      loadKeys();
    } else {
      toast.error("Failed to revoke key");
    }
  }

  const activeCount = keys.filter((k) => k.status === "active").length;
  const limit = tier.apiKeysLimit;

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">
        API Keys
        {limit > 0 && (
          <span className="ml-2 text-sm font-normal text-text-secondary">
            ({activeCount}/{limit} used)
          </span>
        )}
      </h2>

      {limit === 0 ? (
        <p className="text-sm text-text-secondary">
          API access is not available on your plan.
        </p>
      ) : loading ? (
        <div className="h-20 rounded-lg bg-surface-muted animate-pulse" />
      ) : (
        <div className="space-y-3">
          {keys.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No API keys yet. Create one to access the Maroni API.
            </p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-lg border border-border-default bg-surface-primary p-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{key.label}</p>
                  <p className="text-xs text-text-tertiary">
                    {key.keyPrefix}...
                    {key.scopes === "write" ? " (read/write)" : " (read-only)"}
                    {key.lastUsedAt && ` — last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    {key.status === "revoked" && " — revoked"}
                  </p>
                </div>
                {key.status === "active" && (
                  <Button variant="ghost" size="sm" onClick={() => revokeKey(key.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))
          )}

          {activeCount < limit && (
            <div>
              {showCreate ? (
                <div className="space-y-3 rounded-lg border border-border-default bg-surface-primary p-4">
                  <Input
                    placeholder="Key label (e.g., 'Production')"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  <Select value={scopes} onChange={(e) => setScopes(e.target.value)}>
                    <option value="read">Read-only</option>
                    <option value="write">Read & Write</option>
                  </Select>
                  <div className="flex gap-2">
                    <Button onClick={createKey} disabled={!label.trim()}>
                      Create Key
                    </Button>
                    <Button variant="secondary" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
                  Create API Key
                </Button>
              )}
            </div>
          )}

          {newKey && (
            <div className="rounded-lg border border-warning bg-warning/10 p-4">
              <p className="mb-2 text-sm font-medium text-warning">Save your API key</p>
              <code className="block break-all rounded bg-surface-tertiary p-2 text-xs font-mono">
                {newKey}
              </code>
              <p className="mt-2 text-xs text-text-tertiary">
                This key will not be shown again. Store it securely.
              </p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewKey(null)}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

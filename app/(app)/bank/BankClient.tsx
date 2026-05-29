"use client";

import { useState, useCallback } from "react";
import { formatCurrency } from "@/lib/format-currency";
import { Plus, RefreshCw, ExternalLink, Check, X, Banknote, Loader2 } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/app/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import toast from "react-hot-toast";

interface Connection {
  id: string;
  provider: string;
  institutionName: string | null;
  accountMask: string | null;
  status: string;
  lastSyncAt: string | null;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  matchedInvoiceId: string | null;
  matchedExpenseId: string | null;
  status: string;
}

type Tab = "to-review" | "matched" | "ignored";

export default function BankClient({
  connections: initialConnections,
  initialTransactions,
}: {
  connections: Connection[];
  initialTransactions: Transaction[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [tab, setTab] = useState<Tab>("to-review");
  const [syncing, setSyncing] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);

  const filtered = transactions.filter((t) => {
    if (tab === "to-review") return t.status === "unmatched";
    if (tab === "matched") return t.status === "matched";
    return t.status === "ignored";
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/bank/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Sync failed");
        return;
      }
      toast.success(`Synced ${data.synced}/${data.total} accounts`);
      const txRes = await fetch("/api/bank/transactions?limit=200");
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }
      const connRes = await fetch("/api/bank/connections");
      if (connRes.ok) {
        const connData = await connRes.json();
        setConnections(connData);
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkAccount = async () => {
    setLoadingToken(true);
    try {
      const res = await fetch("/api/bank/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to get link token");
        setLoadingToken(false);
        return;
      }
      setLinkToken(data.link_token);
    } catch {
      toast.error("Failed to get link token");
      setLoadingToken(false);
    }
  };

  const handleOnSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      const res = await fetch("/api/bank/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          institutionName: metadata.institution?.name,
          accountName: metadata.accounts?.[0]?.name,
          accountMask: metadata.accounts?.[0]?.mask,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to connect bank");
        return;
      }

      const data = await res.json();
      setConnections((prev) => [
        {
          id: data.id,
          provider: "plaid",
          institutionName: data.institutionName,
          accountMask: data.accountMask,
          status: "active",
          lastSyncAt: null,
        },
        ...prev,
      ]);
      toast.success("Bank account connected");
      setLinkToken(null);
    },
    [],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? null,
    onSuccess: handleOnSuccess,
    onExit: () => setLinkToken(null),
  });

  const handleIgnoreTransaction = async (id: string) => {
    const res = await fetch(`/api/bank/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ignored" }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "ignored" } : t)),
    );
  };

  const handleUnmatchTransaction = async (id: string) => {
    const res = await fetch(`/api/bank/transactions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "unmatched" }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "unmatched", matchedInvoiceId: null, matchedExpenseId: null } : t)),
    );
  };

  const handleConfirmMatch = async (id: string) => {
    const res = await fetch(`/api/bank/confirm-match/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to confirm match");
      return;
    }
    toast.success("Match confirmed");
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "ignored" } : t)),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLinkAccount}
            disabled={loadingToken}
          >
            {loadingToken ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Connect Bank
          </Button>
          {connections.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
          )}
        </div>
        {linkToken && open && (
          <Button
            size="sm"
            onClick={() => open()}
            disabled={!ready}
          >
            <ExternalLink className="h-4 w-4" />
            Open Plaid Link
          </Button>
        )}
      </div>

      {connections.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-surface px-4 py-2.5 text-sm"
            >
              <Banknote className="h-4 w-4 text-text-tertiary" />
              <div>
                <span className="text-text-primary font-medium">
                  {c.institutionName ?? c.provider}
                </span>
                {c.accountMask && (
                  <span className="text-text-tertiary ml-1">
                    ••••{c.accountMask}
                  </span>
                )}
              </div>
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  c.status === "active"
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {c.status}
              </span>
              {c.lastSyncAt && (
                <span className="text-xs text-text-tertiary ml-2">
                  Synced: {new Date(c.lastSyncAt).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border-default">
        {(["to-review", "matched", "ignored"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-accent text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t === "to-review"
              ? "To Review"
              : t === "matched"
              ? "Matched"
              : "Ignored"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            tab === "to-review"
              ? "No transactions to review"
              : tab === "matched"
              ? "No matched transactions"
              : "No ignored transactions"
          }
          description={
            tab === "to-review"
              ? connections.length === 0
                ? "Connect a bank account to start importing transactions."
                : "Sync your accounts to fetch the latest transactions."
              : undefined
          }
          action={
            tab === "to-review" && connections.length === 0
              ? { label: "Connect Bank", onClick: handleLinkAccount }
              : undefined
          }
        >
          <Banknote className="h-12 w-12 text-text-tertiary" />
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell hideBelow="sm">Category</TableCell>
                <TableCell className="text-right">Amount</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-text-secondary">
                    {tx.date}
                  </TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {tx.description}
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary" hideBelow="sm">
                    {tx.category ?? "-"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${
                      tx.amount > 0 ? "text-success" : "text-text-primary"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {tab === "to-review" && (
                        <>
                          {tx.matchedInvoiceId && (
                            <button
                              onClick={() => handleConfirmMatch(tx.id)}
                              className="p-1.5 rounded-md text-success hover:bg-success/10 transition-colors"
                              title="Confirm match"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleIgnoreTransaction(tx.id)}
                            className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-surface-tertiary transition-colors"
                            title="Ignore"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {tab === "matched" && (
                        <button
                          onClick={() => handleUnmatchTransaction(tx.id)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-surface-tertiary transition-colors"
                          title="Unmatch"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

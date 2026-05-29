"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  Trash2,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import toast from "react-hot-toast";
import { extractVariables, renderContractTemplate } from "@/lib/contract-templates";

interface ContractItem {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: string;
  signedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  pdfUrl: string | null;
  signingToken: string;
}

interface TemplateItem {
  id: string;
  name: string;
  body: string;
}

export default function ContractsClient({
  contracts: initialContracts,
}: {
  contracts: ContractItem[];
}) {
  const router = useRouter();
  const [contracts, setContracts] = useState(initialContracts);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<"pick" | "fill" | "preview">("pick");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [title, setTitle] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!showForm || templates.length > 0) return;
    setTemplatesLoading(true);
    fetch("/api/contracts/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates))
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setTemplatesLoading(false));
  }, [showForm, templates.length]);

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Draft", sent: "Sent", signed: "Signed", declined: "Declined", expired: "Expired",
    };
    return labels[status] || status;
  };

  const resetForm = () => {
    setShowForm(false);
    setStep("pick");
    setSelectedTemplate(null);
    setVariables({});
    setClientName("");
    setClientEmail("");
    setTitle("");
  };

  const pickTemplate = (tmpl: TemplateItem) => {
    setSelectedTemplate(tmpl);
    const vars = extractVariables(tmpl.body).filter((v) => v !== "clientName");
    const initial: Record<string, string> = {};
    vars.forEach((v) => { initial[v] = ""; });
    setVariables(initial);
    setStep("fill");
  };

  const handleCreate = async (sendAfterCreate = true) => {
    if (!selectedTemplate || !clientName || !clientEmail || !title) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          clientName,
          clientEmail,
          title,
          variables: { ...variables, clientName },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create contract");
        return;
      }

      const contract = await res.json();

      if (sendAfterCreate) {
        const sendRes = await fetch(`/api/contracts/${contract.id}/send`, { method: "POST" });
        if (sendRes.ok) {
          toast.success("Contract sent to client");
        } else {
          toast.error("Contract created but failed to send");
        }
      } else {
        toast.success("Contract saved as draft");
      }

      resetForm();
      router.refresh();
    } catch {
      toast.error("Failed to create contract");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (id: string) => {
    const res = await fetch(`/api/contracts/${id}/send`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to send contract");
      return;
    }
    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, status: "sent" } : c)));
    toast.success("Contract sent to client");
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contract?")) return;
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete contract");
      return;
    }
    setContracts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contract deleted");
    router.refresh();
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: "default",
      sent: "info",
      signed: "accepted",
      declined: "rejected",
      expired: "warning",
    };
    return map[s] || "default";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New Contract
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-xl border border-border-default bg-surface p-6 space-y-6">
          {step === "pick" && (
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-4">Choose a template</h3>
              {templatesLoading ? (
                <p className="text-sm text-text-tertiary">Loading templates...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => pickTemplate(tmpl)}
                      className="rounded-lg border border-border-default bg-surface-secondary p-4 text-left hover:border-accent transition-colors"
                    >
                      <FileText className="h-5 w-5 text-accent mb-2" />
                      <p className="text-sm font-medium text-text-primary">{tmpl.name}</p>
                      <p className="text-xs text-text-tertiary mt-1">Use this template</p>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={resetForm}
                className="mt-4 text-sm text-text-tertiary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          )}

          {(step === "fill" || step === "preview") && selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-primary">
                  {step === "fill" ? "Fill in the details" : "Preview"}
                </h3>
                <div className="flex gap-2">
                  {step === "preview" && (
                    <Button variant="ghost" size="sm" onClick={() => setStep("fill")}>
                      Back
                    </Button>
                  )}
                  {step === "fill" && (
                    <Button variant="secondary" size="sm" onClick={() => setStep("preview")}>
                      Preview
                    </Button>
                  )}
                </div>
              </div>

              {step === "fill" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Client name *</label>
                    <input
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm"
                      placeholder="e.g. Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Client email *</label>
                    <input
                      required
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm"
                      placeholder="e.g. jane@company.com"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-text-secondary mb-1">Contract title *</label>
                    <input
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm"
                      placeholder="e.g. Freelance Service Agreement"
                    />
                  </div>
                  {Object.entries(variables).map(([key, val]) => (
                    <div key={key}>
                      <label className="block text-xs text-text-secondary mb-1 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </label>
                      <input
                        value={val}
                        onChange={(e) => setVariables((v) => ({ ...v, [key]: e.target.value }))}
                        className="w-full rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm"
                        placeholder={`Enter ${key}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {step === "preview" && (
                <div>
                  <div
                    className="prose prose-sm max-w-none border border-border-default rounded-lg p-4 bg-white max-h-96 overflow-y-auto text-sm"
                    dangerouslySetInnerHTML={{
                      __html: renderContractTemplate(selectedTemplate.body, {
                        ...variables,
                        clientName,
                      }),
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" size="sm" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleCreate(false)} disabled={sending}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save as Draft"
                      )}
                    </Button>
                    <Button size="sm" onClick={() => handleCreate(true)} disabled={sending}>
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send to Client
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {contracts.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          description="Create your first contract to protect yourself before starting work."
          action={showForm ? undefined : { label: "New Contract", onClick: () => setShowForm(true) }}
        >
          <FileText className="h-12 w-12 text-text-tertiary" />
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Signed</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm text-text-secondary">
                    {new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {c.clientName}
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {c.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(c.status) as any}>
                      {statusLabel(c.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {c.signedAt
                      ? new Date(c.signedAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(c.status === "draft") && (
                        <button
                          onClick={() => handleSend(c.id)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-surface-tertiary transition-colors"
                          title="Send"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(c.status === "sent") && (
                        <a
                          href={`/sign/${c.signingToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                          title="View signing page"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {c.pdfUrl && (
                        <a
                          href={c.pdfUrl}
                          download
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                          title="Download PDF"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {(c.status === "draft" || c.status === "declined") && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-[var(--danger)] hover:bg-surface-tertiary transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

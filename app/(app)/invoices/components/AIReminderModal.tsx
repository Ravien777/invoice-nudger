"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Tone = "professional" | "friendly" | "firm" | "casual";

interface AIReminderModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  stepName: string;
  defaultTone: Tone;
  onGenerated: () => void;
}

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "firm", label: "Firm" },
  { value: "casual", label: "Casual" },
];

export default function AIReminderModal({
  open,
  onClose,
  invoiceId,
  stepName,
  defaultTone,
  onGenerated,
}: AIReminderModalProps) {
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{
    subject: string;
    html: string;
    reminderLogId: string;
    usageRemaining: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setGenerated(null);

    try {
      const res = await fetch("/api/ai/generate-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, tone, stepName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to generate AI reminder");
        return;
      }

      setGenerated(data);
      toast.success("AI reminder generated");
      onGenerated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleClose() {
    setGenerated(null);
    setError(null);
    setTone(defaultTone);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Generate AI Reminder
          </h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-muted">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {!generated && !error && (
          <div className="mb-4 rounded-lg bg-surface-muted p-4 text-center">
            <p className="text-sm text-muted">
              Click &quot;Generate&quot; to create an AI-powered reminder email.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-[var(--danger-muted)] p-4 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {generated && (
          <div className="mb-4">
            <div className="mb-2">
              <span className="text-xs font-medium text-muted">Subject</span>
              <p className="text-sm font-medium text-foreground">
                {generated.subject}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted">Preview</span>
              <div
                className="mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-surface p-4 text-sm text-foreground"
                dangerouslySetInnerHTML={{ __html: generated.html }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {generated.usageRemaining} AI reminders remaining this month.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-surface-muted"
          >
            Close
          </button>
          {!generated && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

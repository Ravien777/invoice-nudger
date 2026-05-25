"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/app/components/ui/Button";
import { Select } from "@/app/components/ui/Select";
import { Modal } from "@/app/components/ui/Modal";

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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Generate AI Reminder"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          {!generated && (
            <Button
              variant="primary"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleGenerate}
              disabled={generating}
              loading={generating}
            >
              {generating ? "Generating..." : "Generate"}
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-primary mb-1">
          Tone
        </label>
        <Select
          value={tone}
          onChange={(e) => setTone(e.target.value as Tone)}
        >
          {TONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      {!generated && !error && (
        <div className="mb-4 rounded-lg bg-surface-tertiary p-4 text-center">
          <p className="text-sm text-text-secondary">
            Click &quot;Generate&quot; to create an AI-powered reminder email.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {generated && (
        <div className="mb-4">
          <div className="mb-2">
            <span className="text-xs font-medium text-text-secondary">Subject</span>
            <p className="text-sm font-medium text-text-primary">
              {generated.subject}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-text-secondary">Preview</span>
            <div
              className="mt-1 max-h-64 overflow-auto rounded-lg border border-border-default bg-surface-secondary p-4 text-sm text-text-primary"
              dangerouslySetInnerHTML={{ __html: generated.html }}
            />
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {generated.usageRemaining} AI reminders remaining this month.
          </p>
        </div>
      )}
    </Modal>
  );
}

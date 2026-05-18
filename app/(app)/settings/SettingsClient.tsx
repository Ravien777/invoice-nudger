"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface Step {
  id?: string;
  daysOffset: number;
  emailTemplate: string;
}

interface Schedule {
  id: string;
  name: string;
  isDefault: boolean;
  steps: Step[];
}

interface SettingsClientProps {
  schedule: Schedule | null;
}

function offsetLabel(daysOffset: number): string {
  if (daysOffset < 0) return `${Math.abs(daysOffset)} days before due`;
  if (daysOffset === 0) return "On due date";
  return `${daysOffset} days after due`;
}

export default function SettingsClient({ schedule }: SettingsClientProps) {
  const [steps, setSteps] = useState<Step[]>(
    schedule?.steps ?? []
  );
  const [name, setName] = useState(schedule?.name ?? "Standard");
  const [saving, setSaving] = useState(false);

  function handleStepChange(
    index: number,
    field: "daysOffset" | "emailTemplate",
    value: string
  ) {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: field === "daysOffset" ? parseInt(value, 10) || 0 : value,
      };
      return next;
    });
  }

  function handleAddStep() {
    setSteps((prev) => [
      ...prev,
      { daysOffset: 0, emailTemplate: "" },
    ]);
  }

  function handleRemoveStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (steps.length === 0) {
      toast.error("At least one step is required");
      return;
    }

    for (const step of steps) {
      if (!step.emailTemplate.trim()) {
        toast.error("All steps must have an email template name");
        return;
      }
    }

    setSaving(true);

    try {
      const res = await fetch("/api/schedules/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, steps }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }

      toast.success("Schedule saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!schedule) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-500 dark:text-slate-400">No default reminder schedule found.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Default Reminder Schedule
        </h2>

        <div className="mb-6">
          <label
            htmlFor="scheduleName"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Schedule Name
          </label>
          <input
            type="text"
            id="scheduleName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Steps</h3>
            <button
              onClick={handleAddStep}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              + Add Step
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.id ?? index}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-700/50"
              >
                <span className="w-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                  {index + 1}
                </span>

                <div className="w-36">
                  <label className="block text-xs text-slate-500 dark:text-slate-400">
                    Days offset
                  </label>
                  <input
                    type="number"
                    value={step.daysOffset}
                    onChange={(e) =>
                      handleStepChange(index, "daysOffset", e.target.value)
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  />
                </div>

                <div className="w-40">
                  <label className="block text-xs text-slate-500 dark:text-slate-400">
                    Timing
                  </label>
                  <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">
                    {offsetLabel(step.daysOffset)}
                  </p>
                </div>

                <div className="flex-1">
                  <label className="block text-xs text-slate-500 dark:text-slate-400">
                    Email template
                  </label>
                  <input
                    type="text"
                    value={step.emailTemplate}
                    onChange={(e) =>
                      handleStepChange(index, "emailTemplate", e.target.value)
                    }
                    placeholder="e.g. gentle_reminder"
                    className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  />
                </div>

                <button
                  onClick={() => handleRemoveStep(index)}
                  disabled={steps.length <= 1}
                  className="mt-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  title="Remove step"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

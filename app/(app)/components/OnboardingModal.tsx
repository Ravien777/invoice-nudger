"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/app/components/ui/Button";

const DISMISSED_KEY = "invoice-nudger-onboarding-dismissed";

interface OnboardingModalProps {
  open: boolean;
  onDismiss: () => void;
}

export default function OnboardingModal({
  open,
  onDismiss,
}: OnboardingModalProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) {
        const timer = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [open]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
    onDismiss();
  };

  const handleCreateInvoice = () => {
    handleDismiss();
    router.push("/invoices/new");
  };

  const handleUploadCsv = () => {
    handleDismiss();
    router.push("/invoices");
    toast("Click 'Upload CSV' on the invoices page to get started", {
      icon: "📄",
      duration: 4000,
    });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface-secondary shadow-2xl">
        <div className="px-6 pb-6 pt-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-tertiary">
              <svg
                className="h-7 w-7 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-primary">
              Welcome to Invoice Nudger!
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              You&apos;re all set up. Here&apos;s how to get started:
            </p>
          </div>

          <div className="grid gap-3">
            <button
              onClick={handleCreateInvoice}
              className="flex items-start gap-4 rounded-xl border border-border-default p-4 text-left transition hover:border-accent hover:bg-surface-tertiary"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-text-primary">
                  Create your first invoice
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Add a client, set an amount and due date
                </p>
              </div>
            </button>

            <button
              onClick={handleUploadCsv}
              className="flex items-start gap-4 rounded-xl border border-border-default p-4 text-left transition hover:border-accent hover:bg-surface-tertiary"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-text-primary">
                  Upload a sample CSV
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Bulk-import multiple invoices at once
                </p>
              </div>
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-border-default bg-surface-tertiary p-3">
            <p className="text-xs text-text-secondary">
              <span className="font-medium text-text-primary">Tip:</span> Download{" "}
              <a
                href="/sample-invoices.csv"
                download
                className="font-medium text-accent underline hover:text-text-primary"
              >
                sample-invoices.csv
              </a>{" "}
              and upload it to quickly populate your account.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={handleDismiss}
            >
              Get started
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

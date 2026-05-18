"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

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
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="px-6 pb-6 pt-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
              <svg
                className="h-7 w-7 text-blue-600 dark:text-blue-400"
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
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Welcome to Invoice Nudger!
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              You&apos;re all set up. Here&apos;s how to get started:
            </p>
          </div>

          <div className="grid gap-3">
            <button
              onClick={handleCreateInvoice}
              className="flex items-start gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-800 dark:hover:bg-slate-700/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
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
                <p className="font-medium text-slate-900 dark:text-white">
                  Create your first invoice
                </p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Add a client, set an amount and due date
                </p>
              </div>
            </button>

            <button
              onClick={handleUploadCsv}
              className="flex items-start gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-800 dark:hover:bg-slate-700/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
                <svg
                  className="h-5 w-5 text-green-600 dark:text-green-400"
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
                <p className="font-medium text-slate-900 dark:text-white">
                  Upload a sample CSV
                </p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Bulk-import multiple invoices at once
                </p>
              </div>
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-200">Tip:</span>{" "}
              Download{" "}
              <a
                href="/sample-invoices.csv"
                download
                className="font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                sample-invoices.csv
              </a>{" "}
              and upload it to quickly populate your account.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleDismiss}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
            >
              Get started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function VerifyContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const error = searchParams.get("error");

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
            <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Email verified</h1>
          <p className="text-sm text-muted">
            Your email has been verified. You can now sign in to your account.
          </p>
          <a
            href="/auth/signin"
            className="inline-block rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition hover:brightness-110"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/20">
          <svg className="h-6 w-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {error === "expired" ? "Link expired" : "Verification failed"}
        </h1>
        <p className="text-sm text-muted">
          {error === "expired"
            ? "This verification link has expired. Please create a new account to receive a new link."
            : "This verification link is invalid. Please check the link or create a new account."}
        </p>
        <a
          href="/auth/signup"
          className="inline-block rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          Create account
        </a>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function validatePasswordClient(password: string): string | null {
  if (password.length < 8) return "At least 8 characters";
  if (!/[a-zA-Z]/.test(password)) return "Must contain at least one letter";
  if (!/\d/.test(password)) return "Must contain at least one number";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return "Must contain at least one special character";
  return null;
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!token) {
      setError("Invalid reset link");
      return;
    }

    const pwError = validatePasswordClient(password);
    if (pwError) {
      setFieldErrors({ password: pwError });
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.error && typeof data.error === "object") {
        setFieldErrors(
          Object.fromEntries(
            Object.entries(data.error).map(([key, msgs]) => [key, (msgs as string[])[0]]),
          ),
        );
      } else {
        setError(data.error || "Something went wrong");
      }
    } else {
      setSuccess(true);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Invalid link</h1>
          <p className="text-sm text-muted">
            This password reset link is missing or invalid.
          </p>
          <a
            href="/auth/forgot-password"
            className="inline-block rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition hover:brightness-110"
          >
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
            <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Password set</h1>
          <p className="text-sm text-muted">
            Your password has been set successfully. You can now sign in.
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
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
          <p className="mt-1 text-sm text-muted">
            Choose a new password for your account
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Enter a new password"
              required
            />
            <p className="mt-1 text-xs text-muted">
              At least 8 characters, one letter, one number, one special character
            </p>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-danger">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Repeat your new password"
              required
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-danger">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Setting password..." : "Set password"}
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          <a href="/auth/signin" className="text-accent transition hover:brightness-110">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

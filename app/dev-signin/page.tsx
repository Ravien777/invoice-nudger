"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DevUser {
  id: string;
  email: string;
  name: string | null;
}

export default function DevSigninPage() {
  const router = useRouter();
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    fetch("/api/dev-signin")
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignIn(email: string) {
    setSigningIn(email);
    try {
      const res = await fetch("/api/dev-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      alert("Sign in failed");
    } finally {
      setSigningIn(null);
    }
  }

  async function handleCreateUser() {
    if (!newEmail.trim()) return;
    await handleSignIn(newEmail.trim());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
          Development only
        </div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">
          Quick Sign In
        </h1>

        {loading ? (
          <p className="text-muted">Loading...</p>
        ) : (
          <div className="space-y-4">
            {users.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted">
                  Existing users:
                </p>
                <div className="space-y-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSignIn(user.email)}
                      disabled={signingIn === user.email}
                      className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition hover:border-accent hover:bg-surface-muted disabled:opacity-50"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {user.name || user.email}
                        </p>
                        <p className="text-xs text-muted">{user.email}</p>
                      </div>
                      {signingIn === user.email ? (
                        <span className="text-sm text-accent">
                          Signing in...
                        </span>
                      ) : (
                        <svg
                          className="h-5 w-5 text-muted"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium text-muted">
                Or sign in as a new user:
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                />
                <button
                  onClick={handleCreateUser}
                  disabled={signingIn !== null || !newEmail.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110 disabled:opacity-50"
                >
                  Sign In
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <Link
                href="/"
                className="text-sm text-muted hover:text-foreground"
              >
                Back to home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

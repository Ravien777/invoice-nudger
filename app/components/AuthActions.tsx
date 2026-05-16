"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthActions() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-lg text-slate-900">
          Signed in as <strong>{session.user?.email}</strong>
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("email")}
      className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Sign in with email
    </button>
  );
}

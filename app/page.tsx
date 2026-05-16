import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AuthActions } from "@/app/components/AuthActions";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 rounded-3xl bg-white/90 p-10 shadow-lg shadow-slate-200">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
            Invoice Nudger
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Polite reminders for late payments.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">
            Add invoices, manage clients, and send automated reminder emails
            using NextAuth magic links and Resend email delivery.
          </p>
        </div>

        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-950">
              Get started
            </h2>
            <p className="text-slate-600">
              Sign in with your email to access your invoice dashboard and start
              sending reminder emails.
            </p>
            <AuthActions />
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Quick test
            </p>
            <ul className="mt-4 space-y-3 text-slate-600">
              <li>• Sign in with a magic link</li>
              <li>• Create invoices</li>
              <li>• Upload CSV invoices later</li>
            </ul>
          </div>
        </div>

        {session ? (
          <p className="text-sm text-slate-500">
            You are signed in as <strong>{session.user?.email}</strong>.
          </p>
        ) : null}
      </div>
    </main>
  );
}

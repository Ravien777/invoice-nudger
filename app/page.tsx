import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-slate-900">
            Invoice Nudger
          </span>
          <Link
            href="/api/auth/signin"
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
              Invoice Nudger
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Never chase a late payment again
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Automate polite, escalating email reminders for your unpaid
              invoices. From a gentle nudge to a final notice — we handle the
              follow-ups so you can focus on your work.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/api/auth/signin"
                className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                Start Free Trial
              </Link>
              <Link
                href="/api/auth/signin"
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Free during beta. No credit card required.
            </p>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              Everything you need to get paid on time
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <svg
                    className="h-5 w-5 text-blue-600"
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
                <h3 className="font-semibold text-slate-900">
                  Automated Reminder Sequences
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Set it and forget it. We send 5 escalating reminders — from a
                  gentle nudge 3 days before due to a final notice 14 days after.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <svg
                    className="h-5 w-5 text-green-600"
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
                <h3 className="font-semibold text-slate-900">
                  Bulk CSV Upload
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Import dozens of invoices in seconds. Just upload a CSV with
                  client details, amounts, and due dates. We handle the rest.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <svg
                    className="h-5 w-5 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">
                  Customizable Schedules
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Tailor reminder timing and tone to your workflow. Each invoice
                  can follow its own schedule or inherit your default.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <svg
                    className="h-5 w-5 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">
                  Payment Tracking
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Clients can confirm payment via a shared link. Track paid,
                  unpaid, and overdue status at a glance on your dashboard.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <svg
                    className="h-5 w-5 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">
                  Secure & Private
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Your data is encrypted in transit and at rest. Authentication
                  uses email magic links — no passwords needed.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                  <svg
                    className="h-5 w-5 text-teal-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">
                  Daily Cron Job
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Our scheduler checks every morning at 8am UTC to find which
                  reminders are due — so you never miss a send window.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                  1
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">
                  Add invoices
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Manually create invoices or bulk-upload a CSV. Add client
                  details, amounts, and due dates.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                  2
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">
                  Set your schedule
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Use the default reminder sequence or customize timing and tone
                  for each invoice.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                  3
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">
                  We send reminders
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Our daily cron job checks for due reminders and sends
                  escalating emails until the invoice is paid.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Ready to stop chasing payments?
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Sign up free during beta. No credit card needed.
            </p>
            <div className="mt-8">
              <Link
                href="/api/auth/signin"
                className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Invoice Nudger. All rights
            reserved.
          </p>
          {isDev && (
            <Link
              href="/dev-signin"
              className="text-sm text-amber-600 underline hover:text-amber-800"
            >
              Dev sign-in
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-foreground">
            Invoice Nudger
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/email-templates"
              className="text-sm font-medium text-muted transition hover:text-foreground"
            >
              Templates
            </Link>
            <Link
              href="/api/auth/signin"
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-surface shadow-(--shadow) transition hover:brightness-110"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-border bg-linear-to-b from-surface-muted via-surface to-surface-muted px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              Invoice Nudger
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl ">
              Never chase a late payment again
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted ">
              Automate polite, escalating email reminders for your unpaid
              invoices. From a gentle nudge to a final notice — we handle the
              follow-ups so you can focus on your work.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/api/auth/signin"
                className="rounded-full bg-accent px-6 py-3 text-base font-medium text-surface shadow-(--shadow) transition hover:brightness-110"
              >
                Start Free Trial
              </Link>
              <Link
                href="/api/auth/signin"
                className="rounded-full border border-border bg-surface px-6 py-3 text-base font-medium text-foreground transition hover:bg-surface-muted"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Free during beta. No credit card required.
            </p>
          </div>
        </section>

        <section className="border-b border-border bg-surface px-6 py-20  ">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl ">
              Everything you need to get paid on time
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-3xl border border-border bg-surface-muted p-6 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-accent">
                  <svg
                    className="h-5 w-5"
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
                <h3 className="font-semibold text-foreground ">
                  Automated Reminder Sequences
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Set it and forget it. We send 5 escalating reminders — from a
                  gentle nudge 3 days before due to a final notice 14 days
                  after.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-surface-muted p-6 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md ">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-accent">
                  <svg
                    className="h-5 w-5"
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
                <h3 className="font-semibold text-foreground ">
                  Bulk CSV Upload
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted ">
                  Import dozens of invoices in seconds. Just upload a CSV with
                  client details, amounts, and due dates. We handle the rest.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-surface-muted p-6 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md ">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-accent">
                  <svg
                    className="h-5 w-5"
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
                <h3 className="font-semibold text-foreground ">
                  Customizable Schedules
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted ">
                  Tailor reminder timing and tone to your workflow. Each invoice
                  can follow its own schedule or inherit your default.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-surface-muted p-6 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md ">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-accent">
                  <svg
                    className="h-5 w-5"
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
                <h3 className="font-semibold text-foreground ">
                  Payment Tracking
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted ">
                  Clients can confirm payment via a shared link. Track paid,
                  unpaid, and overdue status at a glance on your dashboard.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-surface-muted p-6 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md ">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-accent">
                  <svg
                    className="h-5 w-5"
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
                <h3 className="font-semibold text-foreground ">
                  Secure & Private
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted ">
                  Your data is encrypted in transit and at rest. Authentication
                  uses email magic links — no passwords needed.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-surface-muted p-6 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md ">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-accent">
                  <svg
                    className="h-5 w-5"
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
                <h3 className="font-semibold text-foreground ">
                  Daily Cron Job
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted ">
                  Our scheduler checks every morning at 8am UTC to find which
                  reminders are due — so you never miss a send window.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface-muted px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-lg font-bold text-accent">
                  1
                </div>
                <h3 className="mt-4 font-semibold text-foreground ">
                  Add invoices
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Manually create invoices or bulk-upload a CSV. Add client
                  details, amounts, and due dates.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-lg font-bold text-accent">
                  2
                </div>
                <h3 className="mt-4 font-semibold text-foreground ">
                  Set your schedule
                </h3>
                <p className="mt-2 text-sm text-muted ">
                  Use the default reminder sequence or customize timing and tone
                  for each invoice.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-lg font-bold text-accent">
                  3
                </div>
                <h3 className="mt-4 font-semibold text-foreground ">
                  We send reminders
                </h3>
                <p className="mt-2 text-sm text-muted ">
                  Our daily cron job checks for due reminders and sends
                  escalating emails until the invoice is paid.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface px-6 py-20 ">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl ">
              Ready to stop chasing payments?
            </h2>
            <p className="mt-4 text-lg text-muted ">
              Sign up free during beta. No credit card needed.
            </p>
            <div className="mt-8">
              <Link
                href="/api/auth/signin"
                className="inline-block rounded-full bg-accent px-8 py-3 text-base font-medium text-surface shadow-sm transition hover:brightness-110"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface px-6 py-8  ">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted ">
            &copy; {new Date().getFullYear()} Invoice Nudger. All rights
            reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/email-templates"
              className="text-sm text-muted transition hover:text-foreground"
            >
              Email Templates
            </Link>
            {isDev && (
              <Link
                href="/dev-signin"
                className="text-sm text-accent underline hover:text-foreground"
              >
                Dev sign-in
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

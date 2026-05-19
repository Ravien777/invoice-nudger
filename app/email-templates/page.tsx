import type { Metadata } from "next";
import Link from "next/link";
import { getAllTemplatePreviews, generateTemplatePdfHtml } from "@/lib/email-templates/preview";
import { TemplateCard } from "./components/TemplateCard";
import { DownloadAllButton } from "./components/DownloadAllButton";

const siteUrl = process.env.NEXTAUTH_URL || "https://invoice-nudger.com";

export const metadata: Metadata = {
  title: "Free Invoice Reminder Email Templates | Invoice Nudger",
  description: "5 professional, escalating email templates for chasing late payments. Copy, customize, and use them free — or automate them with Invoice Nudger.",
  openGraph: {
    title: "Free Invoice Reminder Email Templates | Invoice Nudger",
    description: "5 professional, escalating email templates for chasing late payments. Copy, customize, and use them free.",
    url: `${siteUrl}/email-templates`,
    type: "website",
    siteName: "Invoice Nudger",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Invoice Reminder Email Templates | Invoice Nudger",
    description: "5 professional, escalating email templates for chasing late payments.",
  },
};

export default function EmailTemplatesPage() {
  const templates = getAllTemplatePreviews();
  const isDev = process.env.NODE_ENV === "development";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Free Invoice Reminder Email Templates",
    description: metadata.description,
    url: `${siteUrl}/email-templates`,
    publisher: {
      "@type": "Organization",
      name: "Invoice Nudger",
      url: siteUrl,
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-foreground">
            Invoice Nudger
          </Link>
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
        <section className="border-b border-border bg-linear-to-b from-surface-muted via-surface to-surface-muted px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              Free Templates
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              5 email templates to get you paid faster
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">
              Professional, escalating reminder emails — from a polite nudge to a
              final notice. Copy them free or let us automate the whole sequence.
            </p>
          </div>
        </section>

        <section className="border-b border-border bg-surface px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                Escalation Sequence
              </h2>
              <DownloadAllButton templates={templates} />
            </div>

            <div className="space-y-6">
              {templates.map(({ key, ...template }) => (
                <TemplateCard key={key} {...template} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface-muted px-6 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Stop copying and pasting
            </h2>
            <p className="mt-4 text-lg text-muted">
              Invoice Nudger sends these escalating reminders automatically — on
              schedule, every time. Just add your invoices and we handle the rest.
            </p>
            <div className="mt-8">
              <Link
                href="/api/auth/signin"
                className="inline-block rounded-full bg-accent px-8 py-3 text-base font-medium text-surface shadow-(--shadow) transition hover:brightness-110"
              >
                Automate your reminders — free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} Invoice Nudger. All rights reserved.
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

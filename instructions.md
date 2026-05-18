# Invoice Nudger — AI Coding Agent Instructions

## Overview

This document is an implementation guide for AI coding agents working on Invoice Nudger. It is organized into clear, task-driven features and release phases.

## Priority

1. Phase 1 — Immediate monetisation & marketing
   - Feature 1: Stripe payment links
   - Feature 2: Stripe webhook auto-pay
   - Feature 3: Subscription tiers with usage limits
   - Feature 4: Public email templates page
2. Phase 2 — Advanced platform expansion
   - Feature 5: Accounting integrations
   - Feature 6: AI-generated reminder copy
   - Feature 7: White-labeled client portal
   - Feature 8: Automated reconciliation
   - Feature 9: Promise detection workflow
   - Feature 10: SMS & WhatsApp nudges
   - Feature 11: Late fees / interest calculator

## Agent rules

- Work inside the existing Next.js App Router codebase.
- Keep changes focused on the task and avoid unrelated refactors.
- Use Prisma migrations for database changes.
- Prefer explicit, incremental commits or patches.
- When implementing a feature, include the minimum UI flows needed to verify it.

---

## Phase 1 — Immediate Monetisation & Marketing

### Feature 1: Stripe Payment Links

**Goal:** Add a direct “Pay Now” experience from invoices and reminder emails.

**Implementation:**

- Install Stripe and add env variables: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Add `paymentLink String?` to the `Invoice` Prisma model and migrate.
- Create `/api/stripe/create-payment-link`.
- Validate ownership and `unpaid` status.
- Create a Stripe PaymentLink with invoice amount, currency, and metadata.
- Save the generated URL to the invoice.
- Show the payment link in invoice UI.
- Add a “Pay Now” button inside email templates.
- Add a thank-you page at `/pay/success`.

**Notes:**

- Use `metadata: { invoiceId }`.
- Redirect to `${process.env.NEXTAUTH_URL}/pay/success?invoiceId=...`.

### Feature 2: Stripe Webhook Auto-Mark Paid

**Goal:** Automatically mark invoices paid after Stripe checkout.

**Implementation:**

- Add `/app/api/webhooks/stripe/route.ts`.
- Use raw body parsing for Stripe signature verification.
- Handle `checkout.session.completed`.
- Extract `metadata.invoiceId`, update invoice status, optionally set `paidAt`.
- Log an `auto_paid` event in `ReminderLog`.

**Safety:**

- Ignore already-paid invoices.
- Return 200 if invoice is missing.
- Optionally validate the paid amount.

**UI:**

- Add a “Paid via Stripe” badge for paid invoices with a `paymentLink`.
- Show paid status on `/pay/success`.

### Feature 3: Subscription Tiers & Usage Limits

**Goal:** Add paid plans and limit invoice usage by tier.

**Implementation:**

- Add fields to `User`: `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `subscriptionStatus`.
- Add a `/settings/billing` page.
- Add `/api/stripe/create-checkout-session`.
- Create Stripe subscription sessions and redirect users.
- Extend webhook handling for subscription events.
- Enforce monthly invoice creation limits.
- Add usage indicators to dashboard.
- Add Stripe Customer Portal support.

**Suggested tiers:**

- Free: 5 invoices/month
- Pro: 50 invoices/month
- Agency: Unlimited

### Feature 4: Public Email Templates Page

**Goal:** Create an SEO-friendly templates page for lead capture.

**Implementation:**

- Add a public page at `/templates` or `/email-templates`.
- Display 5 escalation templates.
- Add copy buttons with `navigator.clipboard`.
- Add CTA to sign up.
- Add metadata, Open Graph tags, and SEO schema.
- Link the page from landing navigation and footer.

**Optional:**

- Add a PDF download / email capture flow.

---

## Phase 2 — Advanced Expansion

### Feature 5: Accounting Integrations

**Goal:** Sync invoices with Xero and QuickBooks.

**Implementation:**

- Add OAuth connectors for Xero and QuickBooks.
- Store encrypted tokens in `AccountIntegration`.
- Sync invoices into the app with `externalId` and `source`.
- Push Invoice Nudger payments back to accounting.
- Add UI for connection status and source icons.
- Use scheduled sync jobs or a background queue.

### Feature 6: AI-Generated Reminder Copy

**Goal:** Generate personalized reminder emails with OpenAI.

**Implementation:**

- Add invoice metadata fields like `projectName`.
- Create `/api/ai/generate-reminder`.
- Build prompts for tone, overdue days, payment link, and client details.
- Cache generated copy in `ReminderLog` with `emailBody`.
- Gate the feature behind a paid plan.
- Optionally add an approval/review workflow.

### Feature 7: White-Labeled Client Portal

**Goal:** Offer branded client invoice portals.

**Implementation:**

- Add `/portal/:clientToken`.
- Generate secure client tokens for each client.
- Show invoice list, statuses, due dates, and payment button.
- Support branding from user settings.
- Optionally support magic links or PIN access.
- Reserve for higher-tier plans.

### Feature 8: Automated Payment Reconciliation

**Goal:** Keep invoice status synced across payment sources.

**Implementation:**

- Use Stripe webhook updates.
- Add reconciliation for accounting sync and manual payments.
- Add a dashboard metric for reconciled payments.

### Feature 9: AI Promise Detection

**Goal:** Pause reminders when clients promise payment.

**Implementation:**

- Receive reply emails via webhook.
- Use AI to classify payment promises and extract dates.
- Store `promisedDate` on the invoice.
- Skip reminders until the promise date passes.
- Notify the user when promises are detected.
- Allow manual override.

### Feature 10: SMS & WhatsApp Nudges

**Goal:** Add alternative reminder channels.

**Implementation:**

- Add `clientPhone` and opt-in settings.
- Use Twilio, MessageBird, or similar.
- Send SMS/WhatsApp messages when email fails.
- Require paid plan access.
- Include opt-out language.

### Feature 11: Late Fees & Interest

**Goal:** Automatically apply late fees and interest.

**Implementation:**

- Add late fee policy settings.
- Add invoice fields: `lateFeeEnabled`, `lateFeeAmount`, `interestRate`, `accruedFees`.
- Calculate fees daily in the cron job.
- Update invoice totals and include notes in emails.
- Add a legal disclaimer that this is not legal advice.

---

## Strategy 2 Preview

After Phase 1 and Phase 2 are stable, add analytics to make Invoice Nudger a strategic cashflow product:

- Payment probability scoring
- Client risk profiles
- Industry benchmarks
- Cash flow forecasting

These should be planned once the core product is complete.

# MEMORY.md — Invoice Nudger Decision Log

## Project Identity

- **Product:** Invoice Nudger — automated accounts-receivable platform for freelancers, indie hackers, and micro-agencies.
- **Founder:** Ravien Sewpal
- **Goal:** Eliminate the need for users to ever chase a late payment. Then become indispensable by surfacing insights no other simple tool provides.
- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL + NextAuth.js + Resend + Stripe + Twilio + OpenAI + date-fns + Recharts.
- **Rules of the road:** Simplicity first, surgical changes, no premature abstractions, no drive-by refactoring.

---

## Phase 1 — Core SaaS (Complete)

| Feature | Decision | Rationale | Rejected alternatives |
|---|---|---|---|
| Auth | NextAuth.js magic link (no password) | Zero password management burden, users just click a link | Clerk (too expensive for solo founder), Firebase Auth (vendor lock-in) |
| Reminder engine | Daily cron `/api/cron/send-reminders` with secret auth | Simple, serverless-friendly, Vercel-native | Socket-based real-time (overkill), paid queue services (unnecessary cost) |
| Email | Resend via template functions in `lib/email-templates/` | Clean API, good deliverability, React-free templates | React Email (added complexity for no benefit), SendGrid (worse DX) |
| Invoice limits | `User.plan` string field, checked at creation | Single source of truth, no external API call needed per check | Stripe metadata (requires API call every time) |
| Payment links | Stripe Payment Links embedded in reminder emails | One-time setup, Stripe handles PCI compliance, no custom checkout | Building custom payment form (PCI scope, maintenance) |
| Stripe webhook | `/api/webhooks/stripe` with `constructEvent()` signature verification | Security best practice, raw body parsing | Skipping verification (vulnerable to replay attacks) |

## Phase 1 Decisions

**Why Prisma over raw SQL:** Schema-as-source-of-truth prevents drift, migrations are declarative, and the type-safe client catches mismatches at compile time. Prisma 4 was stable and sufficient — no migration to newer versions needed unless asked.

**Why `unpaid`/`paid`/`cancelled` instead of storing `overdue`:** Overdue is a computed state (`status=unpaid && dueDate < now()`). Storing it as a status would require a cron to update it daily — another source of truth to keep in sync. The daily summary tables handle overdue counts at aggregation time.

**Why feature-based grouping over routes-based:** `/invoices/`, `/clients/`, `/settings/` each own their API routes, components, and utilities. Easier to navigate, delete, or hand off a feature without touching unrelated code.

---

## Phase 2 — Advanced Platform (Complete)

| Feature | Decision | Rationale | Rejected alternatives |
|---|---|---|---|
| Accounting integrations | OAuth2 for Xero & QuickBooks with token encryption (AES-256-GCM) | Direct sync, no middleman service | Codat/Finicity (expensive third-party aggregator) |
| AI reminders | OpenAI chat completions, user approves before send | User retains control, avoids wrong-toned emails | Fully automated (risked alienating clients) |
| Client portal | Magic-link tokens stored in `ClientPortalToken`, no login required | Zero friction for clients, no password to forget | Password-protected portals (higher drop-off) |
| Promise detection | GPT analysis of inbound email replies via Resend inbound webhook | Catches informal promises ("I'll pay Friday") that keyword matching misses | Regex/keyword matching (misses natural language nuance) |
| Late fees | Per-invoice config with grace period, fee cap, daily interest | Flexible enough for different client relationships | Flat global rate (too rigid), no cap (legally risky in some jurisdictions) |
| Reconciliation | Match `PaymentRecord` to `Invoice` by reference ID or amount heuristics | Works with or without Stripe webhook data, catches manual payments too | Full bank-feed reconciliation (Plaid — future feature) |

---

## Strategy 2 — Insights-to-Expert Flywheel (Complete)

### Feature 0: Analytics Data Layer

| Decision | Rationale | Rejected |
|---|---|---|
| Aggregated tables (`InvoiceDailySummary`, `ClientPaymentProfile`) instead of live queries on raw `Invoice` | Dashboard loads in milliseconds even with 10K+ invoices, no query timeout risk | Materialized views (less portable, harder to iterate on schema) |
| `@@unique([userId, date])` on `InvoiceDailySummary` | Enables upsert — one row per user per day, no duplicates if cron runs twice | Storing per-invoice rows (too much data for dashboard queries) |
| `riskScore` formula: `(1 - onTimeRatio) * 0.7 + (avgDaysLate/30) * 0.3` | Simple, explainable, easy to tweak. Weights favour payment history over lateness magnitude | ML model (overkill for MVP, opaque to users) |
| `paymentProbability` heuristic model (no AI) | Transparent, instant, no API cost | ML probability model (too complex, no clear accuracy gain) |
| Cron `/api/cron/compute-analytics` runs nightly | Balances freshness with compute cost. Users can manually refresh via `/api/analytics/refresh` | Real-time computation on every dashboard load (expensive, unnecessary) |

### Feature 1: Client Risk Profiles

| Decision | Rationale | Rejected |
|---|---|---|
| `/app/clients` as a dedicated page (not a dashboard widget) | Enough data (risk score, on-time %, avg days late, amount) to justify its own page. Widget on dashboard shows summary. | Inline on dashboard only (too much info), separate tab in invoice list (harder to discover) |
| `onTimePayments` defined as `paidAt <= dueDate` | Clean, unambiguous. A payment arriving exactly on the due date is on time. | 3-day grace period (arbitrary, differs per user preference) |
| Risk score explanation tooltip | Users trust a score they can verify. Showing the formula builds confidence. | Black-box score (users would ignore or distrust it) |

### Feature 2: Payment Probability

| Decision | Rationale | Rejected |
|---|---|---|
| Stored on `Invoice.paymentProbability` rather than computed on read | Zero query-time cost, survives cache eviction. Updated when invoice created or client profile changes. | Computed on every request (more expensive, adds latency) |
| Premium feature gated under Pro/Agency | Uses historical data and adds significant perceived value. Acts as upgrade incentive. | Free-tier access (no monetisation lever) |
| Color coding: green ≥80%, yellow 50-80%, red <50% | Matches common risk communication conventions. Users intuitively understand traffic-light colours. | Numeric display only (users scan less effectively) |

### Feature 3: Industry Benchmarks

| Decision | Rationale | Rejected |
|---|---|---|
| User-selectable dropdown for industry (not auto-detected) | Privacy-first. Users self-identify. No email-parsing or domain-guessing. | Auto-detect from email domain (unreliable, privacy-invasive) |
| Benchmarks opt-out by default | More data means better benchmarks for everyone. Users can disable in settings. | Opt-in (smaller sample size, less useful benchmarks) |
| Minimum sample size of 10 users before showing benchmark | Prevents misleading comparisons. Single-user "benchmark" is just that user's data. | Show any data regardless of sample size (misleading) |
| Industry + "All Industries" comparison | Even niche industries benefit from cross-industry context. | Show only same-industry (users with small industries see nothing) |

### Feature 4: Cash Flow Forecasting

| Decision | Rationale | Rejected |
|---|---|---|
| Live compute on page load with hourly revalidation | Accurate to the minute. No stale cache issues. Easy to implement with Next.js fetch cache. | Nightly cache stored in DB (complexity of invalidation, not fresh enough) |
| Recharts AreaChart with best/expected/worst lines | Users see the range of possible outcomes, not just a single number. Builds trust in the forecast. | Single-line forecast (hides uncertainty, users assume it's a prediction) |
| Expected payment date = `dueDate + avgDaysLate` for invoices with probability > 0.5 | Uses actual client behaviour to predict payment timing, not just due dates. | Simple due-date-based projection (ignores real payment patterns) |

### Feature 5: Collection Efficiency

| Decision | Rationale | Rejected |
|---|---|---|
| Only analyzes invoices where reminders were actually sent | Self-selection bias makes "reminder vs no-reminder" comparisons invalid. Early payers don't need reminders. | Comparing reminder vs non-reminder invoices (apples-to-oranges, invalid conclusions) |
| Per-template and per-channel conversion rates | Shows exactly which template/channel drives the most payments. Actionable — user can tweak their strategy. | Overall only (hides which specific templates/channels are underperforming) |

### Feature 6: Predictive Alerts

| Decision | Rationale | Rejected |
|---|---|---|
| `Notification` model with JSON metadata, separate from `NotificationUsage` (which tracks SMS/WhatsApp quota) | Clean separation of concerns: alerts are internal notifications, usage tracks outbound channel quotas. | Merged table (different purposes, different query patterns) |
| Deduplication via `notificationExists()` check — looks for same type+metadata within 1 day | Prevents alert spam if cron runs multiple times or user triggers manual refresh. | Idempotency key (more complex, not needed for daily cron) |
| Notification bell in header with badge count | Follows familiar pattern (like GitHub/bell icon). Users know to look there without explanation. | Toast notifications only (ephemeral, no history), email only (too noisy) |

---

## All-time Decisions

### Schema

- `@@unique([userId, date])` and `@@unique([userId, clientEmail])` for aggregated tables — no duplicate rows.
- JSON fields (`metadata`, `alertPreferences`, `activeClientEmails`) for flexible schemaless data — no migration needed when adding new fields.
- `alertPreferences Json?` on `User` — single JSON blob for all alert settings. Simpler than a separate table for what's essentially a key-value config.
- `IndustryBenchmark` uses `@@unique([industry, metric, computedAt])` — keeps daily snapshots, enabling trend charts.

### Architecture

- All `/api/cron/*` endpoints protected by `Authorization: Bearer <CRON_SECRET>` header check.
- All `/api/*` user-facing endpoints protected by `getServerSession()`.
- Analytics queries read from aggregated tables (`InvoiceDailySummary`, `ClientPaymentProfile`) — not raw `Invoice` scans.
- `computeDailySummaryForUser()` runs via cron nightly, plus on-demand via `/api/analytics/refresh`.

### UI/UX

- Dashboard is server-component-heavy, minimising client JS. Only interactive widgets (ForecastWidget, BenchmarkWidget) are client components.
- Charts use Recharts (already in the codebase).
- Notification bell uses a dropdown panel (not a full page redirect) for quick triage. Full notification history at `/notifications`.

---

## Current State

**All phases complete.** The product now covers:
1. Core invoice management + automated reminders
2. Monetisation (Stripe subscriptions, payment links)
3. Advanced features (accounting integrations, AI reminders, client portal, promise detection, multi-channel, late fees, reconciliation)
4. Insights flywheel (analytics data layer, client risk profiles, payment probability, industry benchmarks, cash flow forecasting, collection efficiency, predictive alerts)

---

## Next Priorities

- Deploy the `Notification` and `alertPreferences` schema changes to production via `prisma db push`
- Set up Vercel Cron Jobs for the new cron endpoints (`/api/cron/compute-analytics`, `/api/cron/generate-alerts`)
- Monitor analytics cron execution to ensure no timeouts with large datasets
- Consider a "benchmark seeding" script to populate `IndustryBenchmark` with realistic defaults until enough real users exist
- Front-optimise dashboard query: the efficiency metrics query fetches all reminders + paid invoices — add pagination or caching if slow at scale

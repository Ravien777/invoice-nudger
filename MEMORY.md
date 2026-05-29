# MEMORY.md — Maroni Decision Log

## Project Identity

- **Product:** Maroni — automated accounts-receivable platform for freelancers, indie hackers, and micro-agencies.
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

## Phase A — UX Redesign (Complete)

All authenticated pages now use a unified dark theme with collapsible sidebar, `PageShell` wrapper, and the refactored component library.

| Task | Key files | Status |
|------|-----------|--------|
| A-1 Design tokens + layout shell | `app/design-tokens.css`, sidebar, layout, `PageShell` | Complete |
| A-2 Component library refactor | `Button`, `Badge`, `Table`, `Input`, `Select`, `Modal`, `EmptyState`, `StatCard`, `Toast` | Complete |
| A-3 Shared chrome | `PageShell`, user menu, `NotificationBell`, `NotificationPanel` | Complete |
| A-4.1 Dashboard | `dashboard/page.tsx` — StatCards, Table, Badge, EmptyState | Complete |
| A-4.2 Invoice list | `invoices/InvoicesClient.tsx` — filter bar, bulk actions, pagination | Complete |
| A-4.6 Settings | `settings/SettingsClient.tsx` — 5-tab layout (Profile, Business, Notifications, Billing, Danger Zone) | Complete |
| A-4.7 Client pages | `app/(app)/clients/` — Table, Badge, StatCard polish | Complete |
| Benchmarks | `benchmarks/` page.tsx + BenchmarksClient.tsx — PageShell, Button, EmptyState | Complete |
| Billing | `settings/billing/` page.tsx + BillingClient.tsx — PageShell, Button, Badge, Tailwind tokens | Complete |
| ForecastWidget | `dashboard/ForecastWidget.tsx` — horizon buttons → Button | Complete |
| Promises | `promises/PromisesClient.tsx` — filter tabs → Button | Complete |
| Notifications | `notifications/NotificationsClient.tsx` — filter tabs → Button | Complete |
| Reconciliation | `reconciliation/ReconciliationClient.tsx` — tab bar → Button | Complete |
| InvoiceTable | `components/InvoiceTable.tsx` — 8 action buttons → Button | Complete |
| AIReminderModal | `invoices/components/AIReminderModal.tsx` — Modal, Select, Button, CSS vars | Complete |
| PortalTokenModal | `invoices/components/PortalTokenModal.tsx` — Modal, Input, Button, CSS vars | Complete |
| HeaderActions | `app/(app)/components/HeaderActions.tsx` — Sign Out → Button | Complete |
| ThemeToggle | `app/(app)/components/ThemeToggle.tsx` — raw button → Button (ghost, circular) | Complete |
| OnboardingModal | `app/(app)/components/OnboardingModal.tsx` — 3 buttons → Button, token modernization | Complete |

---

## Phase B — Expense Tracking (Complete)

| Feature | Decision | Rationale | Rejected alternatives |
|---|---|---|---|
| Expense schema | `ExpenseCategory` + `Expense` Prisma models, seeded lazily via `lib/expense-categories.ts` | Lazy seed called from GET handler — no dedicated onboarding API needed | Separate seed endpoint (extra route for one-time setup) |
| Tax fields on User | `taxRate`, `fiscalYearStart`, `taxSavingsAmount` added directly to `User` model | Follows existing pattern (`lateFeeEnabled`, `portalEnabled` live on User) | New `BusinessProfile` model (downstream phases E/G/L/T expect this — caveat documented in `instructions.md`) |
| Expense CRUD | `GET/POST /api/expenses`, `GET/PUT/DELETE /api/expenses/[id]` with Zod validation + owner check | Standard CRUD pattern matching invoices | Combined expense+income endpoint (unnecessary coupling) |
| Expense UI | Inline addition form on list page + month picker filter | Minimal navigation, fast entry | Modal/drawer form (more clicks, slower workflow) |
| Dashboard card | Conditionally shown `StatCard` with `href="/expenses"` when expenses exist this month | Surfaces feature without permanent nav clutter | Always-visible card (wasted space for non-users) |

## Phase C — Tax Estimation & Financial Reports (Complete)

| Feature | Decision | Rationale | Rejected alternatives |
|---|---|---|---|
| Tax estimate API | `GET /api/reports/tax-estimate?year=YYYY` — computes `(grossIncome - deductibleExpenses) × taxRate` | Single endpoint, no complex state machine | Multi-step calculator (over-engineered for an estimate) |
| P&L report API | `GET /api/reports/profit-loss?year=YYYY` — income by month + expenses by category | Separate concerns from tax estimate; both callable independently | Merged endpoint (different query patterns, different consumers) |
| P&L UI | Collapsible section inside `/tax` page, not a separate route | Keeps navigation minimal; P&L is supplementary to tax view | Separate `/reports` page + sidebar nav (more clicks) |
| Set aside tracker | Pro/Agency-gated input field that saves tax savings amount via `PUT /api/settings/profile` | Uses existing profile API — no new endpoint needed | Dedicated tax-savings API (unnecessary route) |
| CSV download | String-join generation in `TaxClient` (no library) | Simpler than adding PapaParse dependency for this use case | PapaParse (heavier, no benefit for simple CSV) |

## Phase D — Quotes & Proposals (Complete)

| Feature | Decision | Rationale | Rejected alternatives |
|---|---|---|---|
| Schema | `Quote` + `QuoteLineItem` as persisted Prisma models | Diverges from Invoice (which uses client-only line items). Line items are **lost on convert-to-invoice** — caveat documented | Client-only line items like Invoice (would lose data on page refresh before convert) |
| Auto-numbering | `Q-001` format computed in POST handler via `MAX(CAST(SUBSTRING(quoteNumber,3) AS INTEGER)) + 1` | Simple, no separate sequence table or transaction lock | UUID-based display numbers (less readable for user-facing quotes) |
| Status lifecycle | `draft → sent → accepted/declined/expired` | PUT/DELETE guarded — only `draft`/`sent` statuses are mutable | Free-form status (prone to inconsistent states) |
| Convert to invoice | `POST /api/quotes/[id]/convert` — creates Invoice with `amount`, 30-day due date | Line items not carried over (no `InvoiceLineItem` model). Invoice uses quote's `clientName`/`clientEmail` | Carrying line items (would require creating InvoiceLineItem table — future improvement) |
| Public respond | `POST /api/quotes/[id]/respond` — no auth, raw `quoteId` as access token | Matches spec simplicity. Creates Notification on accept/decline, redirects to success page | Auth token per quote (added complexity, no clear benefit for single-use URL) |
| Email on Send | **Skipped** — status changed to `sent` only | Designed for future email integration (Resend + `sendQuoteEmail` template) | Inline email send (would need template + error handling — deferred) |
| QuoteForm | Client-side line items with live preview (total auto-computed) | Follows InvoiceForm pattern; user sees final amount before saving | Server-side computation on each line item change (slower UX, more API calls) |
| Public view | `app/quote/[quoteId]/page.tsx` + `QuotePublicClient.tsx` — renders quote doc + Accept/Decline buttons | Self-contained public page, no sidebar/auth wrapper | Embedded modal on main site (requires auth context, more complex) |
| Sidebar nav | "Quotes" with `ScrollText` icon, positioned after Invoices | Follows sidebar ordering convention | Tab in invoices page (less discoverable for a distinct feature) |

## Caveats & Known Gaps

| Area | Caveat | Severity | Future Action |
|---|---|---|---|
| Convert → Invoice | Line items lost on conversion (no `InvoiceLineItem` model) | Medium | Create `InvoiceLineItem` model and migrate data |
| Email on Send | Quote "Send" action changes status only — no email sent | Low | Implement `sendQuoteEmail` template + Resend call |
| BusinessProfile | Tax/expense fields live on `User` but downstream phases E/G/L/T expect `BusinessProfile` | Medium | Extract `BusinessProfile` model, migrate fields |
| P&L expense categories | Categories use text labels from `ExpenseCategory`, not normalized IDs in reports | Low | Join on `ExpenseCategory.id` for consistency |
| Public respond auth | `quoteId` is the sole access token — anyone with the URL can respond | Low | Add optional token-based auth for production use |
| Test coverage | No tests for quote workflows yet | High | Add integration tests for CRUD + convert + respond |

---

## Phase P — Contractor Payroll (Micro-Teams) (Complete)

| Feature | Decision | Rationale | Rejected alternatives |
|---|---|---|---|
| Contractor schema | `Contractor` + `ContractorPayment` Prisma models with `businessName`/`businessAddress` on `BusinessProfile` | Clean separation; BusinessProfile already exists for company info | Adding fields to User (mixes personal with business) |
| Pay endpoint | `POST /api/contractors/[id]/pay` — creates `ContractorPayment` + `Expense` + payslip PDF + email | Single request does everything — user clicks "Pay" and it's done | Separate create-expense + generate-pdf + send-email steps (more API calls, more failure modes) |
| Payslip PDF | React-PDF component in `lib/payslip-pdf.tsx`, generated inline via `@react-pdf/renderer` | Follows existing contract-pdf pattern; no new PDF library | Puppeteer (heavy, slow cold start), PDFKit (different API, new dependency) |
| Payslip storage | Uploaded to Vercel Blob at `payslips/[userId]/[paymentId].pdf` | Matches receipt upload pattern; no custom storage infra | Local filesystem (doesn't scale), S3 directly (more boilerplate) |
| Expense auto-creation | `ContractorPayment` creation auto-creates linked `Expense` with "Professional Services" category | Tax deduction recorded automatically — user doesn't need a separate step | Manual expense entry (forgotten, inaccurate records) |
| Category fallback | Finds or creates "Professional Services" category on pay | Works for users who skipped seed or deleted defaults | Requiring pre-seeded category (fragile) |
| Contractor deletion | Blocked if any payment records exist (`_count.payments > 0`) | Data integrity — orphan payments would break expense links | Cascade delete (loses financial records) |
| Payroll UI | Two-tab layout: "Contractors" + "Payment History" | Clean separation of management vs history | Single list (too noisy), separate pages (more nav) |
| Agency gating | Only Agency plan users see full UI; Free/Pro see upgrade prompt | Contractor payroll is a high-value team feature | Free tier access (no monetisation lever) |
| Sidebar placement | "Payroll" in Zone 1 (main features) after Tax | Primary financial feature, not a setting | Zone 3 / Settings (logically incorrect despite spec wording) |

## Current State

**Phases B–P core complete. Phases G, I, J, K fully complete (all audit items resolved).** The product now covers:
1. Core invoice management + automated reminders
2. Monetisation (Stripe subscriptions, payment links)
3. Advanced features (accounting integrations, AI reminders, client portal, promise detection, multi-channel, late fees, reconciliation)
4. Insights flywheel (analytics data layer, client risk profiles, payment probability, industry benchmarks, cash flow forecasting, collection efficiency, predictive alerts)
5. Expense tracking (categories, CRUD, dashboard card) — Phase B
6. Tax estimation & financial reports (estimate, P&L, CSV download, Pro-gated set aside tracker) — Phase C
7. Quotes & proposals (CRUD, convert-to-invoice, public accept/decline, email on send) — Phase D
8. Time tracking (start/stop timer, manual log, create invoice from hours) — Phase E (audit items remain)
9. Recurring invoices (cron auto-generate, email on send, line items, plan limits, reminder schedule, date handling) — Phase F
10. **Multi-currency** (per-record currency, base currency in BusinessProfile, `formatCurrency` hygiene pass across ForecastWidget/TimeClient/BankClient/PayrollClient/quotes/pay) — **Phase G ✅**
11. Client Portal 2.0 — Phase H ✅ (no issues)
12. **Accounting overview page** (stat cards, income/expense bar chart, cash flow area chart, CSV export) — **Phase I ✅**
13. Mobile-first PWA (service worker, manifest, mobile layout audit, 390px QA pass) — **Phase J ✅**
14. **Contracts & e-signature** (3 system templates auto-seeded, CRUD, public signing page, PDF generated + uploaded to Blob, email on send/sign, 30-day expiry default, save as draft) — **Phase K ✅**
15. Income Allocation / Profit First (allocation profile, allocation records, dashboard widget) — Phase L
16. Bank Import (Plaid integration, PlaidLinkButton component) — Phase M
17. Email Receipts to Account (inbound receipt parsing, assign-receipt-emails) — Phase N
18. Instant Payouts (Stripe Connect, payout API) — Phase O
19. Contractor Payroll (micro-teams, payslip PDF, contractor CRUD, pay + expense + email) — Phase P

## Next Priorities

### Remaining phases (in execution order)

| Step | Phase | Summary |
|------|-------|---------|
| 1 | **E** | Time tracking audit fixes (team context, line items, client dropdown, edit action) |
| 2 | **L** | Income allocation fixes (notification detail, Stripe event, invoice resolution) |
| 3 | **M** | Bank import fixes (cron schedule, matched/ignored status, add-as-expense, Plaid env, notifications, sidebar gating, UX polish) |
| 4 | **N** | Email receipts (banner visibility, OCR optional, attachment parsing) |
| 5 | **O** | Instant payouts (cents bug, fee display, confirmation modal, invoice detail page, allocation logging) |
| 6 | **P** | Contractor payroll audit fixes (sender email, timezone, plan gating, sidebar placement) |
| 7 | **R** | Team & agency (accept GET handler, role change UI) |
| 8 | **S** | Credit score & client health (PDF certificate, avgDaysLate fix, missing stats, table population, score algorithm) |
| 9 | **T** | Cash flow forecast & pay yourself (unify forecast engines, accounting chart, field moves, notification content, tests, sidebar cleanup) |
| 10 | **Q** | Accountant/bookkeeper access (full feature: model, invite/accept/revoke APIs, session context, read-only dashboard, plan gate) |

### Meta
- Add test coverage where missing (each phase verification step).
- Commit and push pending work after each phase.

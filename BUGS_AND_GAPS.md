# Maroni — Complete Bug & Gap Catalog

Generated from systematic audit of PRD.md, README.md, MEMORY.md, instructions.md, and CLAUDE.md.

---

## PRD-Tier Features — Not Started (13)

### Tier 1 — Game-Changers (Revenue/Retention)

| Feature | What's Needed |
|---------|---------------|
| **Auto-Charge Clients (Stripe Connect)** | `ClientPaymentMethod` model; setup-intent endpoint; save-payment-method endpoint; Stripe webhook handler for `setup_intent.succeeded`; charge-on-due-date cron (hourly); PaymentIntent webhook handling; 3-attempt retry escalation (email → SMS → final notice); UI for payment method management + auto-charge toggle; usage metering. |
| **Payment Plans / Installments** | `PaymentPlan` + `PaymentPlanInstallment` models; plan creation API; installment options on public payment page; early payoff endpoint; pause-on-failure logic. |
| **User-Facing API + Webhook Platform** | `ApiKey`, `WebhookEndpoint`, `WebhookDelivery` models; API key CRUD + hashing; auth middleware (`validateUserApiKey()`); `/api/v1/*` read endpoints (invoices, clients, expenses, summary); webhook dispatcher (HMAC-signed POST + delivery log); 3-attempt retry with exponential backoff; rate limiting per key. |
| **Multi-Company / Multi-Entity** | `Organization` + `OrganizationMember` models; auto-migration script for existing users; `organizationId` on all data models; entity switcher UI in sidebar; refactor all queries to scope by `organizationId`; org settings page (name, members, billing); org-level subscription management. |

### Tier 2 — Significant Value-Add

| Feature | What's Needed |
|---------|---------------|
| **Mobile Push Notifications** | VAPID key generation + env vars; `PushSubscription` model; subscribe/unsubscribe endpoints; `web-push` npm package; `beforeinstallprompt` listener in PWA registration; fire notifications on `invoice.paid`, `invoice.overdue`, `payment.received`; opt-in/out settings UI per event type. |
| **A/R Aging Report** | Query logic grouping unpaid invoices into buckets (0-30, 31-60, 61-90, 90+); `/api/reports/aging` endpoint with bucket amounts + counts + by-client breakdown; UI page under Reports; CSV export. |
| **AI Expense Categorization** | `categorizeExpense(description, vendor, categories)` in `lib/openai.ts`; hook into expense creation (POST `/api/expenses`) when no `categoryId` provided; hook into receipt parsing; "AI-suggested" badge; override UI. |
| **Client Portal: File Upload + Messaging** | `PortalFile` model; upload endpoint (`POST /api/portal/upload` via Vercel Blob); files tab in portal UI; upload button (client + business sides); file preview (images, PDFs inline); threaded messaging (text + timestamp); notification to business on client upload/message. |
| **Balance Sheet Report** | Computation logic (assets = outstanding invoices + bank balance; liabilities = unpaid expenses); `/api/reports/balance-sheet` endpoint; UI page; PDF export. |

### Tier 3 — Nice-to-Haves

| Feature | What's Needed |
|---------|---------------|
| **Enhanced Multi-Step Onboarding** | Replace single-modal with 5-step guided wizard: (1) welcome + business name/logo, (2) Stripe Connect or skip, (3) default reminder schedule selector, (4) quick invoice creation form, (5) completion animation + contextual tips. |
| **AI Cash Flow Insights** | `generateCashFlowInsight(forecastData, currentState)` in `lib/openai.ts` returning 2-3 sentence analysis; callout box above forecast chart; cached via `react.cache()`. |
| **Vendor / Bill Pay Management** | `Bill` model (vendorName, amount, currency, dueDate, category, notes, status, paidAt, etc.); CRUD API + UI; upcoming bills view. |
| **Client Credit Scoring** | Dun & Bradstreet / Experian integration; new client detail section "Credit Check" with score + risk level; store in `ClientPaymentProfile.externalCreditScore`. |

---

## Missing Features (Within Implemented Phases)

| ID | Missing Feature | Details |
|----|----------------|---------|
| **I-1** | **Accounting overview page** | `app/(app)/accounting/page.tsx` does not exist. Should have 4 stat cards (total income, total expenses, net profit, outstanding invoices), income/expense bar chart, cash flow area chart, CSV export button. |
| **I-2** | **Export CSV API** | `app/api/reports/export/route.ts` does not exist. Should use PapaParse for CSV generation, return `Content-Disposition: attachment`. |
| **B.5** | **Receipt upload** | No multipart upload endpoint at `/api/upload`. No file input in expense form. Currently uses `@vercel/blob` for dev only — needs Supabase Storage or S3 before production. |

---

## Known Bugs

| ID | Severity | Description | File(s) |
|----|----------|-------------|---------|
| **O-1** | **Bug** | Payout amount returned in cents — Stripe's amount is smallest currency unit; client expects dollars. Divide by 100. | `app/api/payouts/instant/route.ts` |
| **O-2** | **Bug** | Fee always 0 — `(payout as any).fee ?? 0` — Stripe payout object doesn't expose fee at top level. | `app/api/payouts/instant/route.ts` |
| **M-1** | **Critical** | No cron schedule in `vercel.json` for `sync-bank` — automated bank syncing never runs. | `vercel.json` |
| **M-2** | **High** | Confirmed bank matches go to "Ignored" tab instead of "Matched" — `BankClient.tsx` line 180 sets `status: "ignored"` on confirm. | `app/(app)/bank/BankClient.tsx` |
| **K-1** | **Critical** | Contract templates never seeded into DB. `lib/contract-templates.ts` defines 3 templates but no seed script or init endpoint persists them — template picker is always empty. | `lib/contract-templates.ts` (needs init endpoint) |
| **K-2** | **Critical** | Signed PDF stored as base64 data URL in `pdfUrl` field instead of uploaded to Vercel Blob — causes DB bloat, non-properly-downloadable URLs. | Contract signing route |
| **N-1** | **Medium** | Receipt banner default-dismissed — `ExpensesClient.tsx` line 69 uses `useState(true)` so banner is never shown on first visit. | `app/(app)/expenses/ExpensesClient.tsx` |
| **R-1** | **Medium** | Team accept route missing GET handler — email invite links return 405 Method Not Allowed (accountant accept has both GET+POST for browser-click flow). | `app/api/team/accept/route.ts` |
| **S-1** | **High** | Health certificate returns HTML instead of PDF — spec requires `@react-pdf/renderer` PDF with business name, logo, key stats. | Client health certificate route |
| **S-2** | **Medium** | `avgDaysLate` calculation excludes early payments — filters to only positive differences (late payments only), inflating penalty for businesses with mixed early+late patterns. | Analytics computation logic |
| **T-2** | **High** | Dual inconsistent forecast systems — dashboard uses `lib/forecast.ts` (old: best/worst/expected, daily projection, no expenses) while `/forecast` page uses `lib/cashflow.ts` (new: income/expenses/cumulative, weekly buckets). Users see different data in different places. | `lib/forecast.ts` vs `lib/cashflow.ts` |

---

## Phase B — Expense Tracking Gaps

| ID | Issue | Effort | Details |
|----|-------|--------|---------|
| B.4a | Expense count sublabel missing on dashboard | Trivial | Add `subLabel={`${expenseAgg._count} items`}` to expense StatCard in `app/(app)/dashboard/page.tsx` |
| B.4b | No "+ New category" option in dropdown | Low | Add option with value `"__new__"` to category `<select>`; prompt for name; POST to quick-create; select created category. File: `app/(app)/expenses/ExpensesClient.tsx` |
| B.4c | Currency selector missing in expense form | Low | Add currency dropdown next to Amount input using `currencySymbols` map. Schema already supports `currency`. Files: `ExpensesClient.tsx`, `lib/validations.ts` |
| B.4d | Page subtitle mismatch | Trivial | Replace subtitle with `"What you've spent. Used automatically in your profit report."`. File: `app/(app)/expenses/page.tsx` |
| B.4e | Category `color` field unused | Trivial | Apply category's `color` as background tint or dot in the category column. File: `app/(app)/expenses/ExpensesClient.tsx` |

---

## Phase C — Tax Estimation & P&L Gaps

| ID | Issue | Effort | Details |
|----|-------|--------|---------|
| C.1a / CC.1 | No `BusinessProfile` model | Medium | Tax fields (`taxRate`, `fiscalYearStart`, `taxSavingsAmount`), `baseCurrency`, `defaultHourlyRate` live on `User` instead of dedicated model. Affects phases E, G, L, T. |
| C.1b | `currency` field missing from `BusinessProfile` | Bundled | Add `currency String @default("USD")` to new `BusinessProfile` model. |
| C.3a | Tax estimate hardcodes `"USD"` | Low | Read `businessProfile.currency` (fallback `"USD"`) and include in response. File: `app/api/reports/tax-estimate/route.ts` |
| C.4a | P&L API missing month filter | Low | Add optional `?month=YYYY-MM` query parameter. File: `app/api/reports/profit-loss/route.ts` |
| C.4b / CC.3 | CSV uses ad-hoc string join instead of PapaParse | Low | Import `papaparse`, use `Papa.unparse()`. File: `app/(app)/tax/TaxClient.tsx` |
| C.4c | No P&L PDF download | Medium | Add "Download PDF" button (Pro/Agency gated). Client-side or server-side PDF generation. |

---

## Phase D — Quotes & Proposals Gaps

| ID | Issue | Effort | Details |
|----|-------|--------|---------|
| D.1 | Line items lost on convert-to-invoice | Medium | No `InvoiceLineItem` model exists — invoices store flat `amount`. Create model, update convert endpoint to carry over `QuoteLineItem` records. |
| D.2 | No email sent on "Send" | Medium | Add Resend API call in send flow; create `sendQuoteEmail` template linking to public quote view. |
| D.3 | Public respond uses raw `quoteId` as access token | Low | Anyone with URL can accept/decline. Add optional signed token (`?token=...`) validated on respond endpoint. |
| D.4 | Expired status not auto-set | Low | Quotes past `expiryDate` still show as `"sent"`. Add query filter or nightly cron to auto-expire. |

---

## Phase E — Time Tracking Audit Issues

| ID | Severity | Issue |
|----|----------|-------|
| E-1 | Medium | `POST /api/time/create-invoice` doesn't use `getTeamContext` — team members can't create invoices from time entries. |
| E-2 | Medium | `DELETE /api/time/[id]` blocks ALL team members (403 for any teamCtx) instead of only `viewer` role — inconsistent with PUT/stop routes. |
| E-3 | Low | No `InvoiceLineItem` records created from time entries; invoice stores flat `amount` + text note in `notes` field. |
| E-4 | Low | Start timer form uses free-text email input; spec says dropdown of existing clients. |
| E-5 | Low | No redirect to invoice preview after create-invoice. |
| E-6 | Low | No edit action per row (only delete). |
| E-7 | Low | Dead code: `clients` variable fetched server-side but never passed to `TimeClient`. |
| E-8 | Low | `getTeamContext` not explicitly mocked in tests (works due to deep mock, but fragile). |

---

## Phase F — Recurring Invoices Gaps

| ID | Issue | Effort | Details |
|----|-------|--------|---------|
| F.1 | Email on auto-generate missing | Medium | Cron creates invoice but no Resend call when `autoSend=true`. |
| F.2 | No line items support | Medium | Flat amount only. Depends on `InvoiceLineItem` model (D.1). |
| F.3 | Invoice limits bypassed | Low | Cron doesn't check `canCreateInvoice()` before generating. |
| F.4 | Reminder schedule integration missing | Medium | `reminderScheduleId` field missing from `RecurringInvoice` model, form, and cron. |
| F.5 | Day-of-month capped at 28 | Trivial | Use `date-fns` `lastDayOfMonth` to clamp instead of hard cap. |
| F.6 | Calendar quarter misalignment | Low | Quarterly uses `addDays(from, 90)` instead of next calendar quarter start. |
| F.7 | No catch-up/backfill logic | Low | If cron misses a day, only one invoice created. Need loop capped at 3 backfills. |
| F-2 | `nextRunDate` only server-side for monthly | Medium | Weekly/biweekly/quarterly/annually use raw user-provided date instead of computed. |
| F-3 | `description` not copied to generated invoice | Medium | `notes` field left empty on generated invoices. |
| F-5 | No Edit action in UI | Low | User must delete and recreate recurring invoices. |
| F-6 | PUT used for status toggle | Low | Pause/resume sends full PUT with all fields. |
| F-7 | No soft-delete | Low | DELETE does hard delete. |
| F-8 | Day-of-month input shown for "annually" | Low | Spec says monthly/quarterly only. |
| F-9 | Duplicated `computeNextRunDate` in cron | Low | Redefines inline instead of importing from `lib/date-utils`. |
| F-10 | No tests for PUT/DELETE endpoints | Low | Missing test coverage for `PUT /api/recurring/[id]` and `DELETE /api/recurring/[id]`. |
| F-11 | No tests for cron | Low | Missing tests for `process-recurring/route.ts`. |

---

## Phase G — Multi-Currency Audit Issues

| ID | Severity | Issue |
|----|----------|-------|
| G-1 | Critical | `TimeEntry` model missing `currency` field — all time-derived invoices default to `baseCurrency`. |
| G-2 | Medium | `ForecastWidget.tsx` — 8 calls to `formatCurrency(val)` without currency arg (defaults to USD). |
| G-3 | Medium | `TimeClient.tsx` — 3 calls to `formatCurrency(val)` without currency arg. |
| G-4 | Low | `RecurringClient.tsx` hardcodes `USD ($)` instead of offering currency selector. |
| G-5 | Low | `BankClient.tsx` line 336 — raw `{tx.amount.toFixed(2)} {tx.currency}` instead of `formatCurrency`. |
| G-6 | Low | `app/api/bank/confirm-match/[transactionId]/route.ts` line 70 — raw `$${tx.amount.toFixed(2)}`. |
| G-7 | Low | `app/api/contractors/[id]/pay/route.ts` line 132 — manual `$`/currency check. |
| G-8 | Low | `app/api/quotes/[id]/respond/route.ts` line 39 — raw `${currency} ${amount.toFixed(2)}`. |
| G-9 | Low | `PayrollClient.tsx` lines 254, 285 — hardcodes `"USD"` as second arg to `formatCurrency`. |

---

## Phase J — Mobile-First PWA Gaps

| ID | Issue | Effort | Details |
|----|-------|--------|---------|
| J.1 | No service worker | Medium | Add `public/sw.js` with cache-first for static assets, network-first for API routes. Register in `app/layout.tsx`. |
| J.2 | Placeholder SVG icons | Medium | Replace "IN" monogram SVGs with branded PNG icons (192×192, 512×512). Update manifest type. |
| J.3 | Double header on mobile | Medium | Outer layout header + PageShell header appear as two rows. Merge utility actions into PageShell and hide outer on mobile. |
| J.4 | Full mobile QA pass not done | Varies | Manually verify every page at 390px viewport for overflow, clipping, full-width inputs, scrollable tables, 44×44px touch targets. |
| J.5 | No `apple-touch-icon` | Trivial | Add `<link rel="apple-touch-icon" href="/icon-192.png">` to `<head>`. |

---

## Phase L — Income Allocation (Profit First) Gaps

| ID | Severity | Issue |
|----|----------|-------|
| L-1 | Low | Allocation notification message is generic — doesn't include client name or per-bucket breakdown (spec: `"$X received from [Client]. Here's your split: $Y to tax, $Z to you."`). |
| L-2 | Low | No handling for `invoice.payment_succeeded` Stripe event — only `checkout.session.completed` triggers allocation. |
| L-3 | Low | Recent Payments table doesn't resolve `invoiceId` to client name/number — shows date and amounts only. |

---

## Phase M — Bank Import (Plaid) Gaps

| ID | Severity | Issue |
|----|----------|-------|
| M-1 | Critical | No cron schedule in `vercel.json` for `sync-bank` — automated bank syncing never runs. |
| M-2 | High | Confirmed bank matches moved to "Ignored" tab instead of "Matched" (spec says confirmed matches go to "Matched" tab). |
| M-3 | High | No "Add as Expense" button for unmatched transactions (spec requires this per unmatched row). |
| M-4 | Medium | Plaid env vars (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`) missing from `.env.example`. |
| M-5 | Medium | No in-app notification for unmatched credit transactions > $100 (spec requires it). |
| M-6 | Low | "Bank" sidebar nav always visible — spec says only if >= 1 BankConnection. |
| M-7 | Low | Connect Bank UX requires 2 clicks (fetch token → "Open Plaid Link") — spec expects single-click flow. |
| M-8 | Low | Matched tab lacks match details — doesn't display `matchedInvoiceId` or `matchedExpenseId`. |

---

## Phase N — Email Receipts to Account Gaps

| ID | Severity | Issue |
|----|----------|-------|
| N-1 | Medium | Receipt banner default-dismissed — `useState(true)` means banner never shown on first visit. |
| N-2 | Low | Image OCR (AWS Textract) not implemented (optional per spec, but documented gap). |
| N-3 | Low | Mailgun attachment key naming (`attachment-1`, `attachment-2`) may not match `.getAll("attachment")`. |

---

## Phase O — Instant Payouts Gaps

| ID | Severity | Issue |
|----|----------|-------|
| O-1 | Bug | `payout.amount` returned in cents — needs division by 100. |
| O-2 | Bug | Fee always 0 — `(payout as any).fee ?? 0` — Stripe payout object doesn't expose fee at top level. |
| O-3 | Medium | No confirmation modal — uses plain `confirm()` instead of spec'd fee comparison ("Standard vs Instant" with amounts). |
| O-4 | Medium | No invoice detail page (`/invoices/[id]`) exists — payout button only in list table. |
| O-5 | Low | Missing AllocationRecord logging on payout. |

---

## Phase P — Contractor Payroll Gaps

| ID | Severity | Issue |
|----|----------|-------|
| P-1 | Low | Hardcoded sender email `noreply@maroni.app` — should use `process.env.EMAIL_FROM`. |
| P-2 | Low | `paymentDate` parsed as `new Date(paymentDate)` — may shift timezone; should use `new Date(paymentDate + "T00:00:00")`. |
| P-3 | Low | Server fetches contractor/payment data for all plans — wasteful for Free/Pro users who see upgrade prompt. |
| P-4 | Low | Sidebar shows Payroll in zone 1 (visible to all); spec says zone 3 / Agency-only. |

---

## Phase Q — Accountant/Bookkeeper Access Gaps

| ID | Severity | Issue |
|----|----------|-------|
| Q-1 | Medium | Accountant invite route has no plan gate — Free/Pro users can invite despite Agency-only per pricing table. |
| Q-2 | Low | Missing "Download All for Tax Year" button on accountant dashboard. |
| Q-3 | Low | Accountant dashboard shows "Benchmarks" quick link instead of P&L (spec says P&L). |
| Q-4 | Low | Dead code: `requireReadOnlyCheck` defined in `lib/accountant-session.ts` but never called. |

---

## Phase R — Team & Agency Tier Gaps

| ID | Severity | Issue |
|----|----------|-------|
| R-1 | Medium | Team accept route missing GET handler — email invite links return 405 Method Not Allowed (accountant accept has both GET+POST for browser-click flow). |
| R-2 | Low | No "Change Role" action on team member list (only Remove). |

---

## Phase S — Business Credit Score & Client Health Gaps

| ID | Severity | Issue |
|----|----------|-------|
| S-1 | High | Health certificate returns HTML instead of PDF — spec requires `@react-pdf/renderer` PDF with business name, logo, key stats. |
| S-2 | Medium | `avgDaysLate` calculation excludes early payments — filters to only positive differences (late payments only), inflating penalty. |
| S-3 | Medium | Health certificate missing core stats: total invoiced (year), collection rate %, average payment time, on-time payment rate. |
| S-4 | Low | Client health table "Invoices" column always renders "—" instead of actual count. |
| S-5 | Low | Promise redistribution gives flat 8.33 bonus instead of redistributing weights across other signals. |

---

## Phase T — Cash Flow Forecast & "Pay Yourself" Reminder Gaps

| ID | Severity | Issue |
|----|----------|-------|
| T-1 | High | No Accounting page exists — cash flow chart should be a section on `app/(app)/accounting/page.tsx`, but that page isn't built. Chart lives on standalone `/forecast` page instead. |
| T-2 | High | Dual inconsistent forecast systems — dashboard uses `lib/forecast.ts` (old), `/forecast` page uses `lib/cashflow.ts` (new). Users see different data. |
| T-3 | Low | `lastPayYourselfDate` stored on `User` model instead of `BusinessProfile`. |
| T-4 | Low | Cron notification message missing spec'd content (no 💸 emoji, no owner split %). |
| T-5 | Low | No tests for acknowledge endpoint (`POST /api/allocation/pay-yourself-acknowledge`) or `PayYourselfWidget`. |
| T-6 | Low | Cashflow API test coverage thin — no data-scenario tests (different probabilities, recurring bucketing, confidence thresholds). |
| T-7 | Low | Optional Resend email in T.4 cron not implemented. |
| T-8 | Low | Extra "Your Next Pay Yourself Amount" card on dashboard — not in spec (may confuse users vs. the accumulator widget). |
| T-9 | Low | Standalone "Forecast" nav item in sidebar — spec says it should be part of Accounting page. |

---

## Cross-Cutting / Infrastructure

| ID | Issue | Effort | Details |
|----|-------|--------|---------|
| CC.1 | Create `BusinessProfile` model | Medium | Migrate `taxRate`, `fiscalYearStart`, `taxSavingsAmount`, `baseCurrency`, `defaultHourlyRate` from `User` to new model. Needed by phases C, E, G, L, T. |
| CC.2 | Multi-currency hygiene pass | Medium | Consistent currency handling across expenses, reports, forms, and display components. Depends on CC.1. |
| CC.3 | PapaParse adoption | Low | Replace ad-hoc CSV string joining with `Papa.unparse()` where not yet done. |
| — | Receipt upload: production storage | Medium | Migrate from `@vercel/blob` (dev-only) to Supabase Storage or S3 for production. Update `lib/storage.ts`, add env vars, create bucket. |
| — | `InvoiceLineItem` model | Medium | Shared blocker for D.1, F.2, E-3. Create model matching `QuoteLineItem` shape, belongs to `Invoice`. |
| — | Quote workflow test coverage | High | No integration tests for quote CRUD, convert, or respond. |
| — | PlazaOS E2E testing | — | Step 8 of PRD implementation — pending external testing with PlazaOS. |

---

## Summary

| Category | Count |
|----------|-------|
| **PRD-tier features not started** | **13** |
| **Missing features (Phase I entirely)** | **2** |
| **Critical bugs** | **4** (G-1, K-1, K-2, M-1) |
| **High/Medium bugs** | **14** |
| **Low/cosmetic issues** | **50+** |
| **Phases with 0 issues** | **2** (Phase A UX Redesign, Phase H Client Portal 2.0) |
| **Cross-cutting infrastructure items** | **5** |

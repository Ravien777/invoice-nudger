# Overview

| Phase | Status |
|---|---|
| A — UX Redesign | ✅ Complete — no outstanding tasks |
| B — Expense Tracking | ✅ Implemented — 5 known gaps below |
| C — Tax Estimation & P&L | ✅ Implemented — 6 known gaps below |
| D — Quotes & Proposals | ✅ Implemented — 4 known gaps below |
| F — Recurring Invoices | ✅ Implemented — 7 known gaps below |
| J — Mobile-First PWA | ✅ Implemented — 5 known gaps below |
| Q — Accountant / Bookkeeper Access | ❌ Not started — 4 tasks below |

---

# Phase B — Expense Tracking Gaps

## B.4a — Expense count sublabel on dashboard
**Goal:** Show `"X items"` below the expense total in the Expenses This Month StatCard.
**File:** `app/(app)/dashboard/page.tsx`
**Change:** Add `subLabel={`${expenseAgg._count} items`}` to the existing `<StatCard>` for expenses (around line 250).
**Verify:** Navigate to `/dashboard` with ≥1 expense logged; card shows item count beneath the amount.

---

## B.4b — "+ New category" in category dropdown
**Goal:** Category dropdown in the expense form should have a "+ New category" option at the bottom that opens a quick-add prompt.
**File:** `app/(app)/expenses/ExpensesClient.tsx`
**Change:** Add an option to the category `<select>` with value `"__new__"`. When selected, prompt the user for a category name, POST to `/api/expenses` (or a new quick-create endpoint), then select the created category.
**Verify:** Open expense form; scroll to bottom of category list; click "+ New category"; enter name; category appears in list and is selected.

---

## B.4c — Currency selector in expense form
**Goal:** Expense form should allow setting currency per expense instead of hardcoding USD.
**Files:** `app/(app)/expenses/ExpensesClient.tsx`, `lib/validations.ts` (expenseSchema already has `currency` field)
**Change:** Add a currency dropdown next to the Amount input. Use the same currency symbol map used elsewhere (`currencySymbols`). The schema already supports `currency` — it's just not exposed in the UI.
**Verify:** Create an expense with EUR; see it listed with € symbol.

---

## B.4d — Page description mismatch
**Goal:** Expense page subtitle should match the spec: `"What you've spent. Used automatically in your profit report."`
**File:** `app/(app)/expenses/page.tsx`
**Change:** Replace the `subtitle` prop on `PageShell` with the spec text.
**Verify:** Navigate to `/expenses`; heading subtitle shows the correct text.

---

## B.4e — Category `color` unused in UI
**Goal:** The `color` field on `ExpenseCategory` should tint category badges in the expense table.
**Files:** `app/(app)/expenses/ExpensesClient.tsx`
**Change:** When rendering the category column, apply the category's `color` as a background tint or dot color. Falls back to default grey when null.
**Verify:** After setting a color on an expense category, the badge in the list reflects that color.

---

## B.5 — Receipt upload
**Goal:** Users can upload receipt images to expenses.
**Files:** `app/api/upload/route.ts` (new), `lib/storage.ts` (new), `app/(app)/expenses/ExpensesClient.tsx`
**Change:** A multipart upload endpoint at `/api/upload` that stores the file and returns a URL. The expense form has a file input labeled "Attach receipt (optional)". The table shows a paperclip icon when a receipt is attached; clicking opens the file.
**Implemented:** Using `@vercel/blob` for development.
**Before deploying to production:** Migrate to Supabase Storage or S3:
  1. Replace `@vercel/blob` with `@supabase/supabase-js` (or AWS SDK).
  2. Update `lib/storage.ts` — replace `uploadReceipt` and `deleteBlob` with Supabase/S3 equivalents.
  3. Add required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
  4. Create a `receipts` bucket in Supabase Storage (public).
  5. Remove `@vercel/blob` from `package.json` and `BLOB_READ_WRITE_TOKEN` from env.
**Verify:** Upload a JPEG receipt; expense row shows 📎; clicking opens the file.

---

# Phase C — Tax Estimation & P&L Gaps

## C.1a — Create `BusinessProfile` model
**Goal:** Tax settings (`taxRate`, `fiscalYearStart`, `taxSavingsAmount`), `baseCurrency`, and `defaultHourlyRate` should live on a dedicated `BusinessProfile` model instead of `User`.
**Files:** `prisma/schema.prisma`, `app/api/settings/profile/route.ts`, `app/(app)/settings/SettingsClient.tsx`
**Change:**
1. Create `BusinessProfile` model in schema with `userId` (unique, 1:1 with User), `taxRate`, `fiscalYearStart`, `taxSavingsAmount`, `baseCurrency`, `defaultHourlyRate`.
2. Migrate existing data from `User` to `BusinessProfile` via a one-time script.
3. Update Profile API to read/write `BusinessProfile` instead of `User` fields.
4. Update Settings page to use the new API shape.
**Verify:** All tax settings still work; no data loss; `/api/settings/profile` returns business profile fields.
**Effort:** Medium — largest single change, touches schema + API + UI.
**Depends on:** Prisma push and data migration.

---

## C.1b — Add `currency` to BusinessProfile
**Goal:** `BusinessProfile` needs a `currency` field (default `"USD"`).
**Note:** This is bundled with C.1a — add `currency String @default("USD")` to the `BusinessProfile` model when creating it.

---

## C.3a — Tax estimate response uses user's base currency
**Goal:** `/api/reports/tax-estimate` should return the user's base currency instead of hardcoded `"USD"`.
**File:** `app/api/reports/tax-estimate/route.ts`
**Change:** After fetching the user, read `businessProfile.currency` (or `"USD"` fallback) and include it in the response as `currency`.
**Verify:** After setting base currency to EUR in settings, the tax estimate response shows `"currency": "EUR"`.

---

## C.4a — P&L API month filter
**Goal:** `/api/reports/profit-loss` should accept an optional `?month=YYYY-MM` query parameter to filter to a single month.
**File:** `app/api/reports/profit-loss/route.ts`
**Change:** Parse `?month=` param; if present, add a date range filter to both income and expense queries (start of month to end of month).
**Verify:** Call `?year=2025&month=2025-01` and get only January results.

---

## C.4b — Use PapaParse for CSV generation
**Goal:** Replace ad-hoc string-join CSV generation in `TaxClient.tsx` with PapaParse (already in the stack).
**File:** `app/(app)/tax/TaxClient.tsx`
**Change:** Import `papaparse` and use `Papa.unparse()` to generate the CSV blob instead of manual string concatenation.
**Verify:** Download CSV from `/tax` page; open in spreadsheet app — data is correctly formatted.

---

## C.4c — P&L PDF download (Pro feature)
**Goal:** Pro/Agency users should be able to download the P&L report as a PDF.
**Files:** `app/(app)/tax/TaxClient.tsx`, possibly a server-side PDF generation endpoint.
**Change:** Add a "Download PDF" button next to the CSV button, gated behind `plan === "pro" || plan === "agency"`. Generate PDF either client-side (html2canvas/jspdf) or server-side (puppeteer).
**Verify:** Log in as Pro user, navigate to `/tax`, click "Download PDF", receive a valid PDF file.

---

# Phase D — Quotes & Proposals Gaps

## D.1 — Line items lost on convert-to-invoice
**Goal:** When converting a quote to an invoice, the quote's line items should carry over to the invoice.
**Root cause:** No `InvoiceLineItem` model exists — invoices store a flat `amount`. Quotes persist line items in `QuoteLineItem`.
**Files:** `prisma/schema.prisma` (new model), `app/api/quotes/[id]/convert/route.ts`
**Change:**
1. Create `InvoiceLineItem` model (mirrors `QuoteLineItem` shape, belongs to `Invoice`).
2. Run `prisma db push`.
3. Update the convert endpoint to create `InvoiceLineItem` records from the quote's line items instead of just copying the flat amount.
**Verify:** Convert a quote with line items; the resulting invoice shows the same line items.

---

## D.2 — No email sent on "Send" action
**Goal:** Clicking "Send" on a quote should email the quote to the client as an HTML view or PDF.
**File:** `app/(app)/quotes/QuotesClient.tsx` (or the send handler)
**Change:** Add a Resend API call in the send flow that emails the client a link to the public quote view (`/quote/[quoteId]`). Create a `sendQuoteEmail` template in `lib/email-templates/`.
**Verify:** Send a quote; the client receives an email with the quote link.

---

## D.3 — Public respond uses raw quoteId as access token
**Goal:** The public `/quote/[quoteId]` page uses the raw ID as the sole access token — anyone with the URL can accept/decline.
**Risk:** Low for MVP, but if URLs are leaked a third party could respond on behalf of a client.
**Files:** `app/api/quotes/[id]/respond/route.ts`, `app/quote/[quoteId]/page.tsx`
**Change:** Add an optional signed token (`?token=...`) derived from the quote ID + a server secret. Validate on the respond endpoint.
**Verify:** Without token, respond returns 401. With valid token, respond succeeds.
**Priority:** Low — only needed for production deployment.

---

## D.4 — Quote "expired" status not automatically set
**Goal:** Quotes with `expiryDate` in the past should show as `"expired"` instead of `"sent"`.
**File:** `app/api/quotes/route.ts` (GET handler) or a cron job.
**Change:** Add a query filter or update step that marks expired quotes. Simplest: in the GET handler, add a WHERE clause excluding expired ones, or add a nightly cron to auto-expire.
**Verify:** A quote past its expiry date shows as `"expired"` on the list page.

---

# Phase F — Recurring Invoices Gaps

## F.1 — Email on auto-generate
**Goal:** When `autoSend=true` and the cron creates a new invoice, an email should be sent to the client immediately.
**File:** `app/api/cron/process-recurring/route.ts`
**Change:** After creating the invoice, call Resend to send an invoice notification to `clientEmail`. Use the existing email infrastructure.
**Verify:** Set up a recurring invoice with `autoSend=true`; when the cron fires, the client receives an email.

---

## F.2 — Line items support
**Goal:** Recurring invoices should support line items (description × quantity × rate) instead of just a flat amount.
**Root cause:** No `InvoiceLineItem` model exists (same issue as D.1). The recurring form only collects a flat amount.
**Files:** `prisma/schema.prisma` (`InvoiceLineItem`), `lib/validations.ts`, `app/(app)/recurring/RecurringClient.tsx`
**Change:**
1. Create `InvoiceLineItem` model (shared with D.1 fix).
2. Extend the recurring form to accept line items (inline rows like QuoteForm).
3. Store line items on the RecurringInvoice or create them on the generated Invoice.
**Depends on:** D.1 (InvoiceLineItem model creation).

---

## F.3 — Invoice limits bypassed
**Goal:** Auto-generated invoices should respect the user's plan limits.
**File:** `app/api/cron/process-recurring/route.ts`
**Change:** Before creating each invoice, call `canCreateInvoice(user.id, 1)` and skip/skip-and-pause the recurring invoice if the limit is reached.
**Verify:** A free-tier user with 3/3 invoices used hits the limit; the cron skips their recurring invoice and logs a warning.

---

## F.4 — Reminder schedule integration
**Goal:** Recurring invoices should allow selecting a reminder schedule, so generated invoices use the right reminder timing.
**Files:** `prisma/schema.prisma`, `app/(app)/recurring/RecurringClient.tsx`, `app/api/cron/process-recurring/route.ts`
**Change:**
1. Add `reminderScheduleId` to the recurring form (dropdown of user's schedules).
2. When creating invoices in the cron, set `reminderScheduleId` on the new invoice.
**Verify:** Create a recurring invoice with a weekly reminder schedule; generated invoice has the schedule attached.

---

## F.5 — Day-of-month capped at 28
**Goal:** Monthly recurring invoices with `dayOfMonth > 28` should handle short months gracefully instead of capping to 28.
**File:** `lib/date-utils.ts` (or the inline `computeNextRunDate` in the cron)
**Change:** Use `date-fns` `lastDayOfMonth` to detect short months and clamp to the last valid day instead of 28.
**Verify:** Create a recurring invoice with `dayOfMonth=31`; February's invoice fires on the 28th (or 29th in leap years).

---

## F.6 — Calendar quarter alignment
**Goal:** Quarterly frequency should align to calendar quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec) instead of 90-day rolling periods.
**File:** `lib/date-utils.ts`
**Change:** Replace `addDays(from, 90)` with logic that finds the start of the next calendar quarter.
**Verify:** A quarterly recurring invoice created in February fires on April 1 (start of Q2), not 90 days from February.

---

## F.7 — Catch-up logic
**Goal:** If the cron misses a day (downtime, backlog), it should backfill missed invoices instead of only creating one.
**File:** `app/api/cron/process-recurring/route.ts`
**Change:** Loop: while `nextRunDate <= today`, create invoice and advance. Cap at 3 backfills to prevent mass generation after extended downtime.
**Verify:** Manually set `nextRunDate` to 5 days ago; run cron; 5 invoices are created (or 3 with the cap).

---

# Phase J — Mobile-First PWA Gaps

## J.1 — No service worker
**Goal:** Add a service worker for offline asset caching and PWA installability.
**File:** `public/sw.js` (new), `app/layout.tsx`
**Change:** Create a basic `sw.js` with a cache-first strategy for static assets (JS, CSS, fonts) and a network-first strategy for API routes. Register it in `app/layout.tsx`.
**Verify:** Open app in Chrome; Lighthouse PWA audit shows "Service worker registered".

---

## J.2 — Placeholder SVG icons
**Goal:** Replace the placeholder "IN" monogram SVGs with branded PNG icons.
**Files:** `public/icon-192.svg`, `public/icon-512.svg`, `public/manifest.json`
**Change:** Replace SVG files with proper PNG icons (192×192 and 512×512). Update `manifest.json` `type` from `"image/svg+xml"` to `"image/png"`.
**Verify:** Lighthouse PWA audit passes the "icons" check.

---

## J.3 — Double header on mobile
**Goal:** The `(app)/layout.tsx` header (utility bar with notifications/theme/sign-out) and the `PageShell` header (hamburger/title/actions) should merge into a single header on mobile.
**Files:** `app/(app)/layout.tsx`, `app/components/layout/PageShell.tsx`
**Change:** Hide the outer header on mobile (`hidden md:flex`) and move the utility actions (NotificationBell, ThemeToggle) into PageShell's header alongside the hamburger.
**Verify:** On a 390px viewport, only one header row appears.

---

## J.4 — Full mobile QA pass
**Goal:** Every authenticated page should be manually verified at 390px viewport width.
**Action:** Open each page in Chrome DevTools at 390px. Check for:
- Horizontal overflow on main content
- Clipped text or overlapping elements
- Form inputs that aren't full-width
- Tables that don't scroll
- Touch target sizes (min 44×44px for buttons)
**Files:** All pages under `app/(app)/`
**Change:** Fix any issues found per page.
**Verify:** Every page is usable without horizontal scroll on the main content area.

---

## J.5 — No `apple-touch-icon`
**Goal:** iOS Safari should show a custom icon when adding to the home screen.
**File:** `app/layout.tsx`
**Change:** Add `<link rel="apple-touch-icon" href="/icon-192.png">` (or SVG equivalent) to `<head>`.
**Verify:** On iOS Safari, "Add to Home Screen" shows the app icon instead of a screenshot.

---

# Phase Q — Accountant / Bookkeeper Access

## Q.1 — AccountantAccess model
**Goal:** Let users invite an accountant to a read-only view. One role: `"accountant"`. Invitation by email with a token.
**File:** `prisma/schema.prisma`
**Change:** Add `AccountantAccess` model with `ownerId`, `accountantEmail`, `accountantUserId`, `status` (pending/active/revoked), `inviteToken`, timestamps. Add `accountantAccess` relation to `User` as `"OwnerAccess"`. Run `npx prisma db push`.
**Verify:** New `AccountantAccess` table appears in Prisma Studio.

---

## Q.2 — Invite, accept, and revoke APIs
**Goal:** User can invite an accountant by email; accountant accepts via token link; user can revoke at any time.
**Files:** `app/api/accountant/invite/route.ts` (POST), `app/api/accountant/accept/route.ts` (POST, public), `app/api/accountant/revoke/route.ts` (DELETE)
**Change:**
1. `POST /api/accountant/invite` — accept `{ email }`, create `AccountantAccess` record (status `pending`), send invite email via Resend with accept link.
2. `POST /api/accountant/accept` — validate `inviteToken`, set `status = "active"`, set `accountantUserId` if matching user exists.
3. `DELETE /api/accountant/revoke` — owner only, set `status = "revoked"`.
**Verify:** Invite a test email; accept the invite; confirm `status = "active"`; revoke; confirm `status = "revoked"`.

---

## Q.3 — Accountant session context
**Goal:** Accountants see the owner's data in read-only mode across all API routes. Write operations return 403.
**Files:** `lib/accountant-session.ts` (new), all GET API routes (invoices, expenses, reports, tax, clients, quotes, contracts)
**Change:**
1. Create `getAccountantSession(session)` — if logged-in user's email matches an active `AccountantAccess`, return the `ownerId`.
2. In every GET API route: after standard session check, check accountant context. If acting as accountant, query by `ownerId` instead of `session.user.id`.
3. In all POST/PUT/DELETE routes: return `403` with message `"Accountant access is read-only."` if an accountant context is active.
**Verify:** Log in as accountant email; fetch invoices; see owner's data. Try to create an invoice; get 403.

---

## Q.4 — Accountant dashboard and settings UI
**Goal:** Accountants see a read-only branded view with quick links to reports. Owners manage access in Settings.
**Files:** `app/(app)/accountant/[ownerId]/page.tsx` (new), `app/(app)/settings/SettingsClient.tsx` (add Accountant Access section)
**Change:**
1. Show a banner when viewing as accountant: `"You're viewing [BusinessName]'s account in read-only mode."` with a "Return to your account" link.
2. Hide all edit/create/delete buttons. Show quick-access links: P&L, Tax Estimate, Expense Report, Invoice History.
3. Add a "Download All for Tax Year" button that calls the CSV export endpoint.
4. In Settings, add an "Accountant Access" section: list of accountant emails, status badges, "Revoke Access" button.
**Verify:** Log in as accountant; confirm read-only view; download CSV; revoke access; confirm accountant can no longer access.

---

# Cross-Cutting Tasks

## CC.1 — Create `BusinessProfile` model
**See:** C.1a above. This is the same task — migrating `taxRate`, `fiscalYearStart`, `taxSavingsAmount` from `User` to a new `BusinessProfile` model. Phases E (Time Tracking), G (Multi-Currency), L (Profit First), and T (Pay Yourself) all expect this model to exist.

---

## CC.2 — Multi-currency pass
**Goal:** Currency should be consistently handled across the app instead of hardcoded to USD in many places.
**Files:** `app/(app)/expenses/ExpensesClient.tsx`, `app/api/reports/tax-estimate/route.ts`, `app/api/reports/profit-loss/route.ts`, and any display component that formats amounts.
**Change:** Use the user's `BusinessProfile.currency` (fallback `"USD"`) for report APIs. Add currency selectors to forms where missing. Display the correct currency symbol everywhere.
**Depends on:** CC.1 (BusinessProfile model for base currency).

---

## CC.3 — PapaParse adoption
**Goal:** Use PapaParse (already in package.json) for all CSV generation instead of ad-hoc string joining.
**Files:** `app/(app)/tax/TaxClient.tsx`, any future CSV export.
**Change:** Import `papaparse`, use `Papa.unparse()` to generate CSV. Same for any new CSV exports.

---

# Implementation Roadmap

## Batch 1 — Trivial fixes (high confidence, low risk)
1. **B.4a** — Expense count sublabel (trivial, single file)
2. **B.4d** — Page description text (trivial, single file)
3. **B.4e** — Category color rendering (trivial, single file)
4. **F.5** — Day-of-month short month handling (trivial, single function)

## Batch 2 — Low effort, no external deps
5. **C.4a** — P&L month filter (low, one API route)
6. **C.4b / CC.3** — PapaParse adoption (low, one file)
7. **J.5** — apple-touch-icon (trivial, one line in layout)
8. **D.4** — Auto-expire quotes (low, cron or query update)

## Batch 3 — Medium effort, UI changes
9. **B.4b** — "+ New category" dropdown (low, one client file)
10. **B.4c** — Currency selector in expense form (low, one client file)
11. **F.4** — Reminder schedule integration (medium, schema + form + cron)
12. **F.7** — Catch-up logic (low, cron loop)

## Batch 4 — Medium effort, API + UI
13. **J.3** — Header consolidation (medium, layout + PageShell)
14. **J.1** — Service worker (medium, requires testing)
15. **J.2 / J.4** — Brand icons + mobile QA pass (varies, depends on audit)

## Batch 5 — Depends on InvoiceLineItem model
16. **D.1 / F.2** — InvoiceLineItem model + quote conversion + recurring line items (medium, schema + 2 API routes + form)
17. **D.2** — Quote email sending (medium, Resend template + send flow)

## Batch 6 — Depends on file storage
18. **B.5** — Receipt upload (medium, requires Supabase Storage or S3)

## Batch 7 — Depends on BusinessProfile model
19. **C.1a / C.1b / CC.1** — BusinessProfile model + migration (medium, schema + API + UI)
20. **C.3a / CC.2** — Multi-currency pass (medium, APIs + forms + display)
21. **C.4c** — P&L PDF download (medium, client-side or server-side PDF)
22. **D.3** — Signed token for quote respond (low, security hardening)
23. **F.1** — Email on auto-generate (medium, Resend call in cron)
24. **F.3** — Invoice limit enforcement (low, check in cron)
25. **F.6** — Calendar quarter alignment (low, date utility change)

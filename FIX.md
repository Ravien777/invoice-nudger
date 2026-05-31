# Performance Fix Plan

Full codebase audit completed. Issues organized by priority tier.

---

## P0 — Critical (affects every page load)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `app/(app)/layout.tsx:19-30` | `prisma.user.findUnique` + `prisma.bankConnection.count` executed on every page under `(app)/` before rendering. Blocks all 30+ routes. | Move bank count into a streamed Suspense component; use `react.cache()` for user fetch (reuse pattern from `accountant-session.ts`). |
| 2 | `app/api/invoices/route.ts:38-41` | `findMany` with **no `take`**, **no `select`** — returns all 40+ columns of every invoice with no limit. A user with 50K invoices gets them all. | Add `take: 50`, add `select` for only serialized fields (id, invoiceNumber, clientName, amount, currency, status, dueDate). |
| 3 | `lib/alerts.ts:123-136` | **N+1**: iterates `profiles` array and issues `prisma.invoice.findMany({ where: { clientEmail } })` per client. 100 clients = 101 queries. | Batch: `findMany({ where: { clientEmail: { in: profiles.map(p => p.clientEmail) } } })` once, group by clientEmail in memory. |
| 4 | `app/api/cron/send-reminders/route.ts:30-38` | Unbounded `findMany` across **all users** with `include: { user: true, reminderSchedule: { include: { steps: true } } }` — fetches all invoices in the entire app. | Add `take: 1000` with cursor pagination; replace `include: { user: true }` with `select` on only needed fields (plan, aiRemindersEnabled, etc.). |
| 5 | `app/api/cron/calculate-late-fees/route.ts:24-32` | Same unbounded pattern across all users — `findMany` with `include: { user: true }`. | Add `take: 1000` with cursor pagination; replace `include: { user: true }` with targeted `select`. |

---

## P1 — High

| # | File | Issue | Fix |
|---|------|-------|-----|
| 6 | `lib/client-health.ts:188-195` | **N+1**: `Promise.all(profiles.map(p => calculateClientHealthScore(p)))` — each call does 2 more DB queries. | Batch all invoices for the user once with `clientEmail: { in: [...] }`, group in memory, compute scores from grouped data. |
| 7 | All `GET` API routes (~15 files) | **No Cache-Control headers** — every GET refetches fresh data even when nothing changed. No CDN/edge caching. | Add `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` to read-only list endpoints. |
| 8 | `app/api/analytics/efficiency/route.ts:23` | Expensive `computeCollectionEfficiencyForUser()` runs on every request with no caching. | Add `Cache-Control: public, s-maxage=3600` (data changes infrequently) or precompute via cron. |
| 9 | 5 files importing `recharts` | **~500KB** charting library loaded eagerly: `ForecastWidget.tsx`, `ForecastClient.tsx`, `BenchmarksClient.tsx`, `AccountingCharts.tsx`, `ClientDetailClient.tsx`. | Wrap each chart component in `next/dynamic(() => import("./..."), { ssr: false })` in the parent page/server component. |
| 10 | `lib/payslip-pdf.tsx:2`, `lib/contract-pdf.tsx:2` | `@react-pdf/renderer` (~1MB) statically imported at the top level via namespace import. | Change to async factory: `export async function generatePayslipPdf(...) { const ReactPDF = await import("@react-pdf/renderer"); ... }`. Same pattern already used in `health-certificate/route.tsx`. |
| 11 | `StatCard.tsx`, `BenchmarkWidget.tsx`, `FormField.tsx`, `EmptyState.tsx` | **Unnecessary `"use client"`** — purely presentational components with zero hooks, events, or browser APIs. Forces their children + imports into the client bundle. | Remove `"use client"`. Client boundary is already carried by child components (Button, etc.) if needed. |
| 12 | `app/(app)/invoices/page.tsx:18-22`, `expenses/page.tsx:47-52`, `clients/page.tsx:25-30`, `notifications/page.tsx:33-37` | No `select` on page-level `findMany` queries — fetches all columns. | Add `select` for only the fields serialized in the `map()` calls. |
| 13 | Multiple API routes (`contractors`, `contracts`, `quotes`, `recurring`, `bank/transactions`, `reconciliation`) | `findMany` without `select` — returns all columns. | Add `select` for only needed response fields. |

---

## P2 — Medium

| # | File | Issue | Fix |
|---|------|-------|-----|
| 14 | `app/api/contractors/route.ts`, `contracts/route.ts`, `quotes/route.ts`, `recurring/route.ts`, `promises/route.ts` | Unbounded lists — no `take`/`skip` pagination. | Add pagination with `take: 50` (follow `expenses/route.ts` pattern which already has it). |
| 15 | `app/(app)/accounting/page.tsx:109` | `computeForecast(user.id)` blocks entire page render. | Wrap forecast section in Suspense with skeleton fallback (same as dashboard pattern). |
| 16 | `app/(app)/dashboard/page.tsx:45-113` | 10 separate invoice queries (8 counts + 1 groupBy + 1 findMany) block hero/stat cards. | Combine counts via `groupBy({ by: ["status", "reconciliationStatus"], _count: true })` — reduce from 10 queries to 3-4. |
| 17 | `app/(app)/settings/page.tsx:47-56` | 3 separate `prisma.promiseEvent.count(...)` for different statuses. | Replace with single `groupBy({ by: ["status"], _count: true })`. |
| 18 | `ExpensesClient.tsx:72`, `SidebarProvider.tsx:36` | State initialized from localStorage via `useEffect` — causes flash of wrong content on first render (e.g., banner visible briefly then hidden). | Use lazy `useState(() => localStorage.getItem(...) === "true")` initializer. |
| 19 | `prisma/schema.prisma` | Missing composite indexes: `Invoice([userId, clientEmail])`, `Invoice([lateFeeEnabled, status])`, `RecurringInvoice([status, nextRunDate])`, `BankTransaction([userId, status])`, `PromiseEvent([invoiceId, status])`. | Add indexes with `@@index([...])` on the relevant models. |

---

## P3 — Low (diminishing returns)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 20 | `lib/analytics.ts:311`, `lib/alerts.ts:247` | Unbounded `user.findMany({ select: { id: true } })` across all users in batch jobs. | Process users in batches with `take: 1000` + cursor pagination. |
| 21 | `lib/email-templates/index.ts`, `lib/sms-templates/index.ts` | Barrel exports load all 6 template modules even when only one is used. | Lazy-load via `async import()` inside `getTemplate()`. |
| 22 | `next.config.ts` | No `modularizeImports` config — missed build-time optimization for `date-fns` and `lucide-react`. | Add `modularizeImports: { "date-fns": { transform: "date-fns/{{member}}" } }`. |
| 23 | `app/(app)/recurring/RecurringClient.tsx:148` | Module-level (global) `lineItemIdx` variable incremented by all component instances — can produce duplicate keys. | Use `useRef` counter scoped to component instance. |
| 24 | `app/components/layout/SidebarProvider.tsx:76-79` | Context value object recreated on every render, forcing all consumers (`Sidebar`, `PageShell`) to re-render. | Wrap value in `useMemo`. |
| 25 | 29 pages under `(app)/` | Missing `generateMetadata` — all share generic title "Maroni". | Add per-page metadata for SEO. |
| 26 | Multiple API routes | Request body/query params validated manually instead of with Zod. | Add Zod schemas for validation. |
| 27 | `app/api/invoices/route.ts:128`, `app/api/invoices/[id]/route.ts:163` | `computePaymentProbabilityForInvoice()` runs synchronously, blocking the API response. | Fire asynchronously (no `await`) or queue. |

---

## Layout root cause tree

```
app/(app)/layout.tsx (every page load)
  ├─ getServerSession()              → Auth call
  ├─ prisma.user.findUnique()        → DB query  <-- P0-1
  └─ prisma.bankConnection.count()   → DB query  <-- P0-1

Page component (e.g. /invoices, /expenses, /dashboard)
  ├─ getServerSession()              → Duplicate auth call
  ├─ prisma.user.findUnique()        → Duplicate DB query  <-- P0-1
  └─ prisma.X.findMany(...)          → Unbounded if no take  <-- P0-2
       └── No .select()              → Overfetch  <-- P1-12/13

Client bundle (every page with charts)
  └─ Static import of recharts       → ~500KB unnecessary  <-- P1-9

Service worker (public/sw.js)
  └─ fetch() without .catch()        → Network errors  <-- Fix already applied (maroni-v2)
```

## Already fixed (previous sessions)

| Fix | Details |
|-----|---------|
| 30 loading.tsx files | All route directories have skeleton loading pages |
| Dashboard Suspense boundaries | ForecastWidget, Benchmarks, Efficiency, PayYourself stream independently |
| `react.cache()` on computeForecast | Deduplicates DB calls in same render |
| `react.cache()` on getOwnerIdForAccountant | Deduplicates per-request calls |
| Bounded queries | 7 list pages capped (take:50-100), paid-invoice capped (take:1000), confidence query capped (take:100) |
| Background polling skip | NotificationBell, NotificationDropdown, HeaderActions check `document.hidden` |
| Dynamic import of @react-pdf/renderer | On health certificate route only (not main bundle) |
| 8 composite indexes added | Invoice, Expense, TimeEntry, AccountantAccess |
| Service worker fix | Added `.catch()` handler + bumped cache to maroni-v2 |

## Recommended execution order

1. **P0 items 1-5** — eliminate DB round-trips per page + unbounded queries
2. **P1 items 6-13** — bundle reduction, API caching, remove unnecessary client code
3. **P2 items 14-19** — pagination, fewer dashboard queries, DB index speedups
4. **P3 items 20-27** — nice-to-have: metadata, Zod, edge-case fixes

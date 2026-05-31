# Maroni – Performance Fix Manifest

> **Agent rules (read before every task):**
> - Read `MEMORY.md` and `ERRORS.md` before starting any session.
> - State a plan with verifiable steps before writing code.
> - Only touch files directly related to the current task.
> - Confirm before any destructive action, migration, or production call.
> - After each task: list files changed, what changed, files not touched.

---

## Executive Summary

After implementing all feature phases (E, L, M, N, O, P, R, S, T, Q), the app suffers from **severe performance degradation** where many pages get stuck during rendering and never load.

**Root cause:** The app has **zero streaming, zero loading states, zero caching, and pages that run 10–18 blocking database queries** before sending a single byte of HTML to the browser.

**Fix approach:** Incremental — no rewrites. Add loading.tsx, Suspense boundaries, react.cache(), and query limits to unblock pages. Then optimize systematically.

---

## Root Cause Analysis

### Critical (pages hang / never load)

| ID | Why it causes hangs | Impact |
|----|-------------------|--------|
| **PERF-0** (structural) | **Zero `loading.tsx`** files in all 30 route directories. **Zero `<Suspense>` boundaries** anywhere. Every page is a fully blocking server component — no bytes reach the browser until all queries resolve. | **Critical** |
| **PERF-1** (pre-existing) | **Dashboard does 17–18 Prisma queries** before rendering. Query #15 fetches **ALL** paid invoices (`prisma.invoice.findMany` with no `take`). As data grows, this query expands unbounded. With 10K+ paid invoices the page will timeout. | **Critical** |
| **PERF-2** (T-2) | `computeForecast()` runs **6+ queries** — open invoices, recurring, recent expenses, client profiles, paid clients (distinct), oldest paid. The confidence section scans ALL paid invoices with no limit. Called fresh on **three** pages (dashboard, accounting, forecast). No caching. | **High** |
| **PERF-3** (T-1) | **Accounting page** runs 5+ income/expense queries + `computeForecast()` = 11+ queries total. Combined with no streaming, this page blocks entirely until all complete. | **High** |

### Medium (slow loads, high latency)

| ID | Why it's slow | Impact |
|----|--------------|--------|
| **PERF-4** (Q.3) | `getOwnerIdForAccountant()` runs `prisma.accountantAccess.findFirst` on **every API request**, even for non-accountants. Adds unnecessary DB round-trip to every API call. | **Medium** |
| **PERF-5** (Phase L) | Dashboard added `allocationRecord.findFirst` query to the already-heavy 17-query batch. | **Medium** |
| **PERF-6** (S-1) | `@react-pdf/renderer` is heavy, CPU-intensive PDF generation in a serverless function — can cause 504s. | **Medium** |
| **PERF-7** (layout) | **14 client-side `useEffect`+`fetch` waterfalls** — NotificationBell (60s poll), NotificationDropdown (30s poll), HeaderActions (60s poll), GlobalSearch. These fire on every page and block hydration. | **Medium** |
| **PERF-8** (E, M, O, P) | Each phase added 1–3 queries to their respective pages. Individually small, collectively significant. | **Low** |

---

## Task List

### Completed

| ID | Priority | Summary | Verified |
|----|----------|---------|----------|
| PERF-0a | **Critical** | `loading.tsx` added to 5 hottest pages: dashboard, accounting, forecast, health, tax | 30/30 routes have loading.tsx |
| PERF-0b | **High** | Dashboard sections wrapped in `<Suspense>` — benchmarks, efficiency, pay yourself, forecast stream independently | 525 tests pass, TS clean |
| PERF-0c | **Medium** | `loading.tsx` added to all 30 route directories under `app/(app)/` | 25 newly created |
| PERF-1a | **Critical** | Paid invoice query capped with `take: 1000` on dashboard | Line patched, tests pass |
| PERF-2a | **High** | `computeForecast()` wrapped with `react.cache()` — deduplicates calls within same render | Tests pass, TS clean |
| PERF-2b | **Medium** | Forecast confidence query bounded with `take: 100` | Line patched, tests pass |
| PERF-4a | **High** | `getOwnerIdForAccountant()` wrapped with `react.cache()` | Tests pass, TS clean |
| PERF-6a | **Medium** | `@react-pdf/renderer` dynamically imported in health certificate route | Route uses `await import()` |
| PERF-7a | **Medium** | Background tab polling stopped — `if (document.hidden) return` added to NotificationBell, NotificationDropdown, HeaderActions | All 3 components patched |
| PERF-10 | **High** | Composite indexes added to Invoice, Expense, TimeEntry, AccountantAccess models | Schema updated (migration pending) |
| PERF-11 | **Low** | `take: 50–100` added to 7 major list pages (invoices, expenses, clients, contracts, quotes, recurring, promises) | 97 unbounded findMany calls remain in APIs/libs |
| — | **Cleanup** | Fixed pre-existing missing `ForecastDay`/`ForecastWeek` type defs; removed unused date-fns imports | TS errors eliminated |

### Deferred / Blocked

| ID | Priority | Summary | Reason |
|----|----------|---------|--------|
| PERF-1b | **Medium** | Use `InvoiceDailySummary` aggregated table for avgDaysToPay | Table exists in schema but has no cron job to populate it — blocked until cron is built |
| PERF-4b | **Medium** | Inline AccountantAccess query into user fetch | `react.cache()` + new `@@index([accountantEmail, status])` already optimize the query; 46 call sites make this a mechanical refactor with diminishing returns |

### Needs Migration (ask before running)

`npx prisma db push` (safe — adds indexes, no data changes)

```prisma
model Invoice {
  @@index([userId, status, paidAt])
  @@index([userId, status, createdAt])
  @@index([userId, createdAt])
  @@index([userId, reconciliationStatus])
}

model Expense {
  @@index([userId, date])
  @@index([userId, status, date])
}

model TimeEntry {
  @@index([userId, startTime])
}

model AccountantAccess {
  @@index([accountantEmail, status])
}
```

> **Important:** Read `MEMORY.md` and `ERRORS.md` before beginning any task. Execute each task's verification step before marking it complete.

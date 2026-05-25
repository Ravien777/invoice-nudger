# Phase A — Complete

The UX redesign Phase A is fully delivered. All authenticated pages now use `PageShell`, `Button`, `Badge`, `Table`, and the rest of the component library.

**No outstanding Phase A tasks remain.**

---

# Next Steps — Design Polish & Remaining Work

## 1. Shared Layout Components

### 1.1 HeaderActions.tsx
- **File:** `app/(app)/components/HeaderActions.tsx`
- **Done:** Sign Out button converted to `<Button variant="ghost" size="sm">`
- **Remaining:** CSS var references (`var(--warning)`, `var(--warning-muted)` in the promises badge link) — low priority, still functional

### 1.2 ThemeToggle.tsx
- **File:** `app/(app)/components/ThemeToggle.tsx`
- **Done:** Raw `<button>` → `<Button variant="ghost" size="md" className="h-10 w-10 rounded-full border border-border bg-surface text-foreground shadow-sm">` with inline SVGs for sun/moon icons
- Verified: icon-only circular button, Escape/click handling via Button's built-in props

### 1.3 OnboardingModal.tsx
- **File:** `app/(app)/components/OnboardingModal.tsx`
- **Done:** 3 raw `<button>`s → `<Button>` components, old tokens (`bg-surface`, `text-foreground`, `text-muted`, `border-border`, `bg-surface-muted`) modernized
- Kept raw modal structure (it's a wizard-style card, not compatible with Modal component's single-panel layout)

## 2. Token Migration Cleanup

Files still using old token names (`bg-surface`, `text-foreground`, `text-muted`, `border-border` instead of modern equivalents):

| File | Tokens to replace | Priority |
|------|-------------------|----------|
| `app/(app)/settings/SettingsClient.tsx` | `bg-surface`, `text-foreground`, `text-muted`, `border-border` scattered throughout | Low (cosmetic) |
| `app/(app)/dashboard/ForecastWidget.tsx` | CSS `var()` in SVG gradient `<stop>` elements (`var(--success)`, `var(--accent)`, `var(--danger)`) — these still work but use old syntax | Low (functional) |

## 3. Future Design Work

- **InvoiceForm.tsx** — raw `<textarea>` at line 593 (no Textarea component exists yet), raw toggle at lines 642/644
- **Responsive audit** — verify all pages look correct on mobile viewports
- **Animation polish** — add page transitions, micro-interactions on buttons/cards
- **Accessibility pass** — ensure focus indicators, aria labels, keyboard navigation across all pages

---

# Phase B & C — Remaining Gaps & Future Work

Phase **B (Expense Tracking)** and **C (Tax Estimation & P&L)** are implemented but have known gaps relative to the `NEXT.md` spec. Below is the full audit and a recommended implementation order.

## Phase B Gaps

| # | Gap | Spec Requirement | Current State | Effort |
|---|---|---|---|---|
| B.4a | **Dashboard widget missing `subLabel`** | `subLabel: "X items"` showing expense count | `app/(app)/dashboard/page.tsx` StatCard only shows amount, no item count | Trivial |
| B.4b | **No "+ New category" in dropdown** | Category dropdown should have "+ New category" option at the bottom | `app/(app)/expenses/ExpensesClient.tsx` only lists existing categories | Low |
| B.4c | **No currency selector in expense form** | Expense form should allow setting currency per expense | Amount prefix hardcoded to `currencySymbol("USD")` in `ExpensesClient.tsx` | Low |
| B.4d | **Page description mismatch** | `"What you've spent. Used automatically in your profit report."` | Currently `"Track what you spend so you know what you actually earned."` | Trivial |
| B.4e | **Category `color` unused in UI** | `color` field on `ExpenseCategory` should tint category badges/styling | Stored in DB but never rendered | Trivial |
| B.5 | **Receipt upload** | Upload endpoint (`/api/expenses/upload-receipt`), file input in form, 📎 icon in table linking to URL | Schema stores `receiptUrl` but no upload mechanism. Requires Supabase Storage (or equivalent) setup | Medium |

## Phase C Gaps

| # | Gap | Spec Requirement | Current State | Effort |
|---|---|---|---|---|
| C.1a | **No `BusinessProfile` model** | Tax settings, `baseCurrency`, `defaultHourlyRate` should live on a dedicated `BusinessProfile` model | Fields added directly to `User`. Downstream phases (E, G, L, T) all expect `BusinessProfile` | Medium |
| C.1b | **Missing `BusinessProfile.currency`** | `currency String @default("USD")` on BusinessProfile | Not created | Trivial (part of C.1a) |
| C.3a | **Tax estimate response hardcodes USD** | `currency` should come from user's base currency | `/api/reports/tax-estimate` always returns `"USD"` | Low |
| C.4a | **P&L API missing `?month=` filter** | Accept optional `?month=` to filter to a single month | `/api/reports/profit-loss` only accepts `?year=` | Low |
| C.4b | **PapaParse not used for CSV** | Spec says to use PapaParse (already in stack) for CSV generation | `TaxClient.tsx` uses simple string join | Low |
| C.4c | **No PDF download** | Pro/Agency users should get a PDF download of the P&L report | Not implemented (was marked "lower priority — skip if complex") | Medium |

## Cross-Cutting Gaps

| # | Gap | Why It Matters | Effort |
|---|---|---|---|
| CC.1 | **Create `BusinessProfile` model** | Migrate `taxRate`, `fiscalYearStart`, `taxSavingsAmount` from `User` to `BusinessProfile`. Add `baseCurrency`, `defaultHourlyRate`. Phases E (Time), G (Multi-Currency), L (Profit First), T (Pay Yourself) all reference this model. | Medium |
| CC.2 | **Multi-currency pass** | Currency should be selectable in expense form, tax/P&L APIs should use user's base currency, display symbols correctly. Currently everything is hardcoded USD. | Medium |
| CC.3 | **PapaParse adoption** | Replace ad-hoc CSV string generation in `TaxClient.tsx` with PapaParse for consistency with the stack. Applies to all future CSV exports. | Low |

## Recommended Implementation Order

1. **Trivial fixes** (B.4a, B.4d, B.4e) — can batch into one commit
2. **PapaParse adoption** (C.4b, CC.3) — unify CSV generation across the codebase
3. **P&L month filter + PDF download** (C.4a, C.4c) — complete the C.4 spec
4. **Currency in expense form + tax API** (B.4c, C.3a, CC.2) — multi-currency for expenses
5. **"+ New category" in category dropdown** (B.4b) — UX improvement
6. **Receipt upload** (B.5) — requires configuring Supabase Storage or S3
7. **`BusinessProfile` model** (C.1a, C.1b, CC.1) — largest change. Migrate existing tax fields from `User`, create the model, update profile API + settings page. Do last since it touches schema, multiple API routes, and settings UI.

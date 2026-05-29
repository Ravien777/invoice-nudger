# Maroni – Task Manifest for AI Coders

> **Agent rules (read before every task):**
> - Read `MEMORY.md` and `ERRORS.md` before starting any session.
> - State a plan with verifiable steps before writing code.
> - Only touch files directly related to the current task.
> - Confirm before any destructive action, migration, or production call.
> - After each task: list files changed, what changed, files not touched.

---

## Task List by Phase & ID

Each task block contains:
- **ID** – unique reference
- **Summary** – one‑line description
- **Priority** – Critical / High / Medium / Low
- **Status** – Not Started (gap), Gap (known gap), Issue (from audit), Bug (confirmed defect)
- **Dependencies** – IDs of tasks that must be completed first
- **Files** – files to create or modify (relative to project root)
- **Description** – detailed goal
- **Steps** – ordered implementation instructions
- **Verification** – how to confirm success
- **Notes** – optional context

---

### Phase E — Time Tracking

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| E‑1 | Medium | `POST /api/time/create-invoice` doesn’t use `getTeamContext` – team members can’t create invoices. | `app/api/time/create-invoice/route.ts` | Integrate `getTeamContext`, use owner ID if team context. |
| E‑2 | Medium | `DELETE /api/time/[id]` blocks all team members (403) instead of just `viewer`. | `app/api/time/[id]/route.ts` | Adjust role check: allow `editor`/`admin` to delete. |
| E‑3 | Low | No `InvoiceLineItem` created from time entries; flat amount + notes. | `app/api/time/create-invoice/route.ts` | Use `InvoiceLineItem` model (D.1) to store each time entry as a line item. |
| E‑4 | Low | Start timer form uses free‑text email; spec says dropdown of clients. | `app/(app)/time/TimeClient.tsx` | Replace input with a client select dropdown. |
| E‑5 | Low | No redirect to invoice preview after create‑invoice. | `app/api/time/create-invoice/route.ts` or client | Return invoice ID and redirect client‑side. |
| E‑6 | Low | No edit action per row (only delete). | `TimeClient.tsx` | Add edit button that opens a form. |
| E‑7 | Low | Dead code: `clients` fetched server‑side but never passed to `TimeClient`. | `app/(app)/time/page.tsx` | Either pass clients to component or remove server fetch. |
| E‑8 | Low | `getTeamContext` not explicitly mocked in tests. | Test files | Add explicit mock. |

---

### Phase L — Income Allocation (Profit First)

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| L‑1 | Low | Allocation notification missing client name and bucket breakdown. | Allocation cron/notification | Enhance message with `clientName` and per‑bucket amounts. |
| L‑2 | Low | No handling for `invoice.payment_succeeded` Stripe event. | Webhook handler | Add webhook case for `invoice.payment_succeeded`. |
| L‑3 | Low | Recent Payments table doesn’t resolve invoice to client name/number. | UI | Join invoice→client data in API or client side. |

---

### Phase M — Bank Import

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| M‑1 | **Critical** | No cron schedule in `vercel.json` for `sync-bank`. | `vercel.json` | Add a cron job entry. |
| M‑2 | High | Confirmed bank matches moved to “Ignored” tab instead of “Matched”. | `BankClient.tsx` line 180 | Set status to `"matched"` instead of `"ignored"`. |
| M‑3 | High | “Add as Expense” button missing for unmatched transactions. | `BankClient.tsx` | Add button that opens expense form pre‑filled with transaction data. |
| M‑4 | Medium | Plaid env vars missing from `.env.example`. | `.env.example` | Add `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`. |
| M‑5 | Medium | No in‑app notification for unmatched credit >$100. | Bank sync logic | After sync, check for credit transactions > $100 and create a notification. |
| M‑6 | Low | “Bank” sidebar nav always visible. | `Sidebar.tsx` | Only show if user has ≥1 BankConnection. |
| M‑7 | Low | Connect Bank UX requires 2 clicks (fetch token → “Open Plaid Link”). | `BankClient.tsx` | Combine into single flow (fetch token then immediately open Plaid Link). |
| M‑8 | Low | Matched tab lacks match details (invoice/expense ID). | `BankClient.tsx` | Display `matchedInvoiceId` / `matchedExpenseId` with link. |

---

### Phase N — Email Receipts to Account

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| N‑1 | Medium | Receipt banner default‑dismissed – `useState(true)`. | `ExpensesClient.tsx` line 69 | Change initial state to `false` so banner shows on first visit. |
| N‑2 | Low | Image OCR (AWS Textract) not implemented. | (optional) | (Skip or implement per spec) |
| N‑3 | Low | Mailgun attachment key naming may not match. | Inbound email parser | Ensure `attachment-1`, `attachment-2` are handled correctly. |

---

### Phase O — Instant Payouts

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| O‑1 | Bug | `payout.amount` returned in cents – divide by 100. | Payout display component | Convert from cents to dollars. |
| O‑2 | Bug | Fee always 0 – Stripe payout object doesn’t expose fee. | Same | Fetch fee from balance transaction or use correct field. |
| O‑3 | Medium | No confirmation modal (uses plain `confirm()`). | Payout UI | Build modal with fee comparison (“Standard vs Instant”). |
| O‑4 | Medium | No invoice detail page (`/invoices/[id]`) – payout button only in list. | Create invoice detail page | Build page showing invoice, include payout button. |
| O‑5 | Low | Missing AllocationRecord logging on payout. | Payout handler | Log allocation record as per spec. |

---

### Phase P — Contractor Payroll

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| P‑1 | Low | Hardcoded sender email `noreply@maroni.app`. | Pay route | Use `process.env.EMAIL_FROM`. |
| P‑2 | Low | `paymentDate` parsed without timezone offset. | Pay route | Use `new Date(paymentDate + "T00:00:00")`. |
| P‑3 | Low | Server fetches contractor/payment data for all plans. | Payroll API | Only fetch if plan is Agency; else return upgrade prompt. |
| P‑4 | Low | Sidebar shows Payroll in zone 1 (visible to all). | `Sidebar.tsx` | Move to zone 3 (Agency only). |

---

### Phase R — Team & Agency Tier

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| R‑1 | Medium | Team accept route missing GET handler – email invite links give 405. | `app/api/team/accept/route.ts` | Add GET handler to render an accept page. |
| R‑2 | Low | No “Change Role” action on team member list. | Team settings UI | Add dropdown to change role. |

---

### Phase S — Business Credit Score & Client Health

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| S‑1 | High | Health certificate returns HTML instead of PDF. | Certificate endpoint | Use `@react-pdf/renderer` to generate PDF with business name, logo, key stats. |
| S‑2 | Medium | `avgDaysLate` excludes early payments – inflates penalty. | Health score calculation | Include all payments (negative differences = early). |
| S‑3 | Medium | Certificate missing core stats: total invoiced (year), collection rate %, avg payment time, on‑time %. | Certificate logic | Add those stats. |
| S‑4 | Low | Client health table “Invoices” column always “—”. | Client health UI | Populate with actual invoice count. |
| S‑5 | Low | Promise redistribution gives flat 8.33 bonus instead of redistributing weights. | Score algorithm | Distribute weight proportionally across other signals. |

---

### Phase T — Cash Flow Forecast & “Pay Yourself” Reminder

| ID   | Priority | Summary | Files | Steps |
|------|----------|---------|-------|-------|
| T‑1 | High | Accounting page missing (same as I‑1) – cash flow chart should be there. | `app/(app)/accounting/page.tsx` | Build accounting page with unified cash flow chart. |
| T‑2 | High | Dual inconsistent forecast systems – dashboard uses `lib/forecast.ts`, `/forecast` uses `lib/cashflow.ts`. | Dashboard, forecast page, accounting page | Unify to a single forecast engine; display consistent data. |
| T‑3 | Low | `lastPayYourselfDate` on `User` model instead of `BusinessProfile`. | Schema, API | Move field to `BusinessProfile` (aligned with CC.1). |
| T‑4 | Low | Cron notification missing spec content (💸 emoji, owner split %). | Cron notification | Update message. |
| T‑5 | Low | No tests for acknowledge endpoint or PayYourselfWidget. | Test files | Write tests. |
| T‑6 | Low | Cashflow API test coverage thin. | Test files | Add data‑scenario tests. |
| T‑7 | Low | Optional Resend email in T.4 cron not implemented. | Cron | Implement optional email. |
| T‑8 | Low | Extra “Your Next Pay Yourself Amount” card on dashboard not in spec. | Dashboard | Consider removal or clarification. |
| T‑9 | Low | Standalone “Forecast” nav item in sidebar – spec says part of Accounting. | `Sidebar.tsx` | Remove standalone nav item; link to Accounting page. |

---

### Phase Q — Accountant / Bookkeeper Access

#### Q.1 – AccountantAccess model
- **Priority:** Not started
- **Dependencies:** None
- **Files:** `prisma/schema.prisma`
- **Description:** Model with `ownerId`, `accountantEmail`, `accountantUserId`, `status` (pending/active/revoked), `inviteToken`, timestamps. Relation on `User` as `"OwnerAccess"`.
- **Steps:** Add model, run `npx prisma db push`.
- **Verification:** Table appears in Prisma Studio.

#### Q.2 – Invite, accept, revoke APIs
- **Priority:** Not started
- **Dependencies:** Q.1
- **Files:** `app/api/accountant/invite/route.ts`, `app/api/accountant/accept/route.ts`, `app/api/accountant/revoke/route.ts`
- **Description:**
  - `POST /invite` – create `AccountantAccess` (pending), send invite email with token link.
  - `POST /accept` – validate token, set status active, link `accountantUserId`.
  - `DELETE /revoke` – owner only, set status revoked.
- **Verification:** Invite email, accept, status = active, revoke → status = revoked.

#### Q.3 – Accountant session context
- **Priority:** Not started
- **Dependencies:** Q.2
- **Files:** `lib/accountant-session.ts` (new), all GET API routes (invoices, expenses, reports, tax, clients, quotes, contracts), all POST/PUT/DELETE routes
- **Description:** Accountants see owner’s data in read‑only mode. Write operations return 403.
- **Steps:**
  1. Create `getAccountantSession(session)` – if user email matches active `AccountantAccess`, return `ownerId`.
  2. In every GET route, after session check, if accountant context, query by `ownerId`.
  3. In POST/PUT/DELETE routes, return 403 with message if accountant context active.
- **Verification:** Login as accountant; fetch invoices → owner’s data; try to create invoice → 403.

#### Q.4 – Accountant dashboard and settings UI
- **Priority:** Not started
- **Dependencies:** Q.3
- **Files:** `app/(app)/accountant/[ownerId]/page.tsx` (new), `app/(app)/settings/SettingsClient.tsx`
- **Description:** Read‑only view with banner, quick‑link reports, download button. Settings section to manage access.
- **Steps:**
  1. Create dashboard page with banner “You’re viewing [BusinessName]’s account in read‑only mode.”
  2. Show quick links: P&L, Tax Estimate, Expense Report, Invoice History.
  3. Add “Download All for Tax Year” button (CSV export).
  4. In Settings, add “Accountant Access” section: list of accountants, status badges, Revoke button.
  5. Hide all edit/create/delete buttons.
- **Verification:** Accountant sees read‑only view, downloads CSV, revoke removes access.

#### Q‑audit‑1 – Plan gate on accountant invite
- **Priority:** Medium
- **Status:** Issue (Q-1 audit)
- **Dependencies:** Q.1
- **Files:** `app/api/accountant/invite/route.ts`
- **Description:** Only Agency plan users may invite accountants.
- **Steps:** Add check for `user.plan === "agency"`; return 403 otherwise.
- **Verification:** Free/Pro users get 403 when trying to invite.

---

## Suggested Execution Order

| Step | Phase | Rationale |
|------|-------|-----------|
| 1 | **E** | Time tracking — small audit fixes, no schema changes |
| 2 | **L** | Income allocation — 3 small tasks, no schema changes |
| 3 | **M** | Bank import — critical cron fix (M-1), quick wins |
| 4 | **N** | Email receipts — tiny (1-line fix) |
| 5 | **O** | Instant payouts — bugs + modals |
| 6 | **P** | Contractor payroll — 4 small fixes |
| 7 | **R** | Team & agency — 2 small fixes |
| 8 | **S** | Credit score — medium effort, involves PDF gen |
| 9 | **T** | Forecast — medium effort, involves unification |
| 10 | **Q** | Accountant access — largest effort, standalone feature |

> **Important:** Read `MEMORY.md` and `ERRORS.md` before beginning any phase. Execute each task’s verification step before marking it complete.

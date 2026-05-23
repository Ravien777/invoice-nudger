# NEXT.md — Invoice Nudger: Complete Finance Solution

## From Invoice Chaser → Freelancer & SME Finance Hub

**North Star:** Every feature must pass the "would a 15-year-old understand this?" test. Power is revealed progressively. Simple first, powerful always.

**Prerequisites complete:** Phase 1 (core SaaS + monetisation), Phase 2 (advanced platform), Strategy 2 (analytics flywheel) are all built and stable. The existing NEXT.md simplification work (Phases 1–8) is complete or in progress. This document extends the roadmap into a full finance suite.

**Agent rules (read before every task):**

- Read `MEMORY.md` and `ERRORS.md` before starting any session.
- State a plan with verifiable steps before writing code.
- Only touch files directly related to the current task.
- Confirm before any destructive action, migration, or production call.
- After each task: list files changed, what changed, files not touched.

---

## Roadmap Overview

| Phase | What                                                       | Effort         | Impact |
| ----- | ---------------------------------------------------------- | -------------- | ------ |
| A     | Existing NEXT.md work (UX simplification + legal invoices) | ✅ In progress | High   |
| B     | Expense Tracking                                           | Medium         | High   |
| C     | Tax Estimation & Reports                                   | Medium         | High   |
| D     | Quotes & Proposals                                         | Medium         | High   |
| E     | Time Tracking                                              | Medium         | Medium |
| F     | Recurring Invoices & Retainers                             | Low            | High   |
| G     | Multi-Currency                                             | Medium         | Medium |
| H     | Client Portal 2.0                                          | Medium         | High   |
| I     | Basic Accounting (P&L, Balance Sheet)                      | High           | High   |
| J     | Mobile-First PWA                                           | Low            | Medium |
| K     | Contracts & E-Signature                                    | Medium         | High   |
| L     | Income Allocation (Profit First)                           | Medium         | High   |
| M     | Automated Bank Import                                      | Medium         | High   |
| N     | Email Receipts to Account                                  | Medium         | High   |
| O     | Instant Payouts                                            | Low            | High   |
| P     | Contractor Payroll (Micro-Teams)                           | High           | Medium |
| Q     | Accountant / Bookkeeper Access                             | Low            | High   |
| R     | Team & Agency Tier (roles + seats)                         | Medium         | High   |
| S     | Business Credit Score & Client Health                      | Low            | High   |
| T     | Cash Flow Forecast & "Pay Yourself"                        | Medium         | High   |

**Implementation order:** K and L first — contracts close the quote→invoice pipeline and income allocation is the emotional core of the product. Then M and N (bank import + email receipts) for data automation. Then Q and R (accountant + team access) to unlock Agency tier upgrades. Then O, P, S, T.

---

# PHASE A: UX simplification + legal invoices

@instructions.md

---

# PHASE B: Expense Tracking

**Goal:** Let users log expenses (what they spent) so they can see their true profit, not just what they invoiced. Keep it dead simple — just enough to be useful at tax time.

**Plain English to users:** "Track what you spend so you know what you actually earned."

**Simplicity rules:**

- Default view: a list with a big "+ Add Expense" button. Nothing else.
- Categories auto-suggest based on description. User never has to pick a category manually if they don't want to.
- Receipt upload is optional, not required.

---

## Task B.1: Prisma schema — Expense model

**File:** `prisma/schema.prisma`

**Plan:**

1. Add `Expense` and `ExpenseCategory` models.
2. Run `npx prisma db push`.
3. Verify: `npx prisma studio` shows new tables with correct columns.

```prisma
model ExpenseCategory {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String    // e.g. "Software", "Travel", "Office Supplies"
  color     String?   // hex color for UI display
  isDefault Boolean   @default(false)
  expenses  Expense[]
  createdAt DateTime  @default(now())

  @@unique([userId, name])
}

model Expense {
  id          String           @id @default(cuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId  String?
  category    ExpenseCategory? @relation(fields: [categoryId], references: [id])
  description String
  amount      Float
  currency    String           @default("USD")
  date        DateTime         @db.Date
  vendor      String?          // e.g. "Amazon", "Adobe"
  receiptUrl  String?          // uploaded file URL (Supabase Storage or S3)
  taxDeductible Boolean        @default(true)
  notes       String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}
```

**Add relations to User model:**

- `expenses       Expense[]`
- `expenseCategories ExpenseCategory[]`

**Verify:** No existing User fields broken. `npx prisma db push` runs without error.

---

## Task B.2: Seed default expense categories

**File:** `app/api/onboarding/create-demo-data/route.ts`

**Plan:**

1. After creating demo invoices (existing logic), also create default expense categories for the user.
2. Use a static list of sensible defaults.
3. Verify categories appear for new users in the database.

Add this after the existing demo invoice creation:

```ts
const defaultCategories = [
  "Software & Subscriptions",
  "Office Supplies",
  "Travel & Transport",
  "Marketing & Advertising",
  "Professional Services",
  "Equipment",
  "Meals & Entertainment",
  "Utilities",
  "Other",
];

await Promise.all(
  defaultCategories.map((name) =>
    prisma.expenseCategory.upsert({
      where: { userId_name: { userId: session.user.id, name } },
      update: {},
      create: { userId: session.user.id, name, isDefault: true },
    }),
  ),
);
```

**Verify:** After running the demo-data endpoint, query `ExpenseCategory` table and see 9 rows for the test user.

---

## Task B.3: API routes for expenses

**Files:** `app/api/expenses/route.ts` (new) and `app/api/expenses/[id]/route.ts` (new)

**Plan:**

1. Create `GET /api/expenses` — returns paginated expenses for the session user. Supports query params: `?month=2025-01&categoryId=...&page=1`.
2. Create `POST /api/expenses` — creates a new expense. Validates with Zod.
3. Create `PUT /api/expenses/[id]` — updates an expense (owner check).
4. Create `DELETE /api/expenses/[id]` — deletes an expense (owner check).
5. Verify all routes reject unauthenticated requests.

**For `GET /api/expenses`:**

- Default: current month.
- Returns: `{ expenses: [...], total: number, page: number }`.
- Each expense includes: id, description, amount, currency, date, vendor, categoryId, category.name, category.color, taxDeductible, receiptUrl.

**Zod schema for POST/PUT:**

```ts
const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  vendor: z.string().optional(),
  categoryId: z.string().optional(),
  taxDeductible: z.boolean().default(true),
  notes: z.string().optional(),
  receiptUrl: z.string().url().optional(),
});
```

**Owner check pattern (copy from existing invoice routes):**

```ts
const expense = await prisma.expense.findFirst({
  where: { id: params.id, userId: session.user.id },
});
if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

**Verify:** Use a REST client (or curl) to POST a new expense and GET it back.

---

## Task B.4: Expense list page

**File:** `app/(app)/expenses/page.tsx` (new server component)
**File:** `app/(app)/expenses/ExpensesClient.tsx` (new client component)

**Plan:**

1. Server component: fetch current month's expenses and categories server-side.
2. Client component: renders the table and the "+ Add Expense" button.
3. The "+ Add Expense" button opens an inline form (not a new page — stay on the same page).
4. Add `"Expenses"` to the sidebar nav after `"Clients"`.
5. Add page description below heading: `"What you've spent. Used automatically in your profit report."`
6. Verify: Page loads with correct data.

**Table columns:** Date | Description | Vendor | Category | Amount | Tax Deductible | Actions (edit, delete)

**Inline add form fields (simple, in order):**

- Description (required) — text input
- Amount (required) — number with currency symbol prefix
- Date (required) — date picker, default today
- Vendor (optional) — text input
- Category (optional) — dropdown of user's categories, with "+ New category" at the bottom
- Tax Deductible — checkbox, default checked
- Save button

**No receipt upload in this task.** That is Task B.5 (optional enhancement).

**Simplicity rule:** Category is optional. If left blank, it goes to "Uncategorised" in reports. Never block saving because a category wasn't chosen.

**Verify:** Add 3 expenses; they appear in the list immediately (optimistic update or re-fetch).

---

## Task B.5: Receipt upload (optional enhancement)

**File:** `app/api/expenses/upload-receipt/route.ts` (new)

**Plan:**

1. Accept a `multipart/form-data` POST with a file field named `receipt`.
2. Upload the file to Supabase Storage bucket `receipts` (or whichever storage you use). Return the public URL.
3. The expense form gains a "Attach receipt (optional)" file input. On file select, it immediately uploads and stores the URL in state; on save, the URL is included in the expense payload.
4. In the expense list, show a small 📎 icon if a receipt is attached; clicking it opens the URL in a new tab.
5. Verify: Upload a JPEG; the URL is stored; it opens correctly.

**Storage note:** Do not store files in the database. Store only the URL.

---

## Task B.6: Expense summary widget on dashboard

**File:** `app/(app)/dashboard/` — whichever file renders dashboard widgets.

**Plan:**

1. Fetch this month's total expenses for the current user (simple `SUM` query on `Expense` table).
2. Add a stat card: `"Expenses This Month"` | value: `$X,XXX` | sub-label: `"X items"`.
3. Only show this card if the user has at least 1 expense (don't show an empty card for new users).
4. Clicking the card navigates to `/expenses`.
5. Verify: After adding expenses, the widget shows correct values.

---

---

# PHASE C: Tax Estimation & Financial Reports

**Goal:** Automatically calculate estimated tax owed based on income (paid invoices) minus deductible expenses. Show a Profit & Loss summary. These two features are the biggest "wow" moment for freelancers.

**Plain English to users:** "We'll tell you roughly how much tax to set aside based on what you've earned and spent."

**Simplicity rules:**

- Tax estimation is a guide, not legal advice. Show a disclaimer every time.
- Default tax rate is configurable. The app does not try to compute actual tax brackets — just: `(income - deductible expenses) × tax rate = estimated tax`.
- P&L is one table with two sections: Income and Expenses. Nothing more.

---

## Task C.1: Tax settings in Business Profile

**File:** `prisma/schema.prisma` — add to `BusinessProfile` model.

**Plan:**

1. Add fields:
   - `taxRate Float? @default(0.25)` — self-employment tax rate as a decimal (0.25 = 25%)
   - `fiscalYearStart Int? @default(1)` — month number (1 = January, 4 = April for UK tax year)
   - `currency String @default("USD")`
2. Run `npx prisma db push`.
3. Add these fields to the Business Profile settings form (Task B.4's settings page). Show them as:
   - "Your approximate tax rate (%)" — number input, default 25. Help text: "Used to estimate how much to set aside. Ask your accountant for the right number."
   - "Tax year starts in" — dropdown of months (January, February, ..., December).
4. Verify: Save settings; read them back from the database correctly.

---

## Task C.2: Tax estimation API

**File:** `app/api/reports/tax-estimate/route.ts` (new, GET, authenticated)

**Plan:**

1. Accept query param `?year=2025` (default: current tax year).
2. Compute:
   - `grossIncome`: sum of all `Invoice.amount` where `status = "paid"` and `paidAt` is within the tax year.
   - `totalExpenses`: sum of all `Expense.amount` where `taxDeductible = true` and `date` is within the tax year.
   - `taxableIncome`: `grossIncome - totalExpenses` (floor at 0).
   - `estimatedTax`: `taxableIncome × user.businessProfile.taxRate` (or 0.25 if not set).
   - `alreadySetAside`: not tracked yet — set to `null` for now.
3. Return JSON:
   ```json
   {
     "year": 2025,
     "grossIncome": 48000,
     "totalExpenses": 6200,
     "taxableIncome": 41800,
     "estimatedTax": 10450,
     "taxRate": 0.25,
     "currency": "USD"
   }
   ```
4. Verify: Seed invoices and expenses; call the endpoint; check the maths manually.

---

## Task C.3: Tax estimation page

**File:** `app/(app)/tax/page.tsx` (new) and `app/(app)/tax/TaxClient.tsx` (new)

**Plan:**

1. Add `"Tax"` to the sidebar navigation (after Expenses, before Insights/Settings).
2. Page heading: `"Tax Estimate"`. Sub-heading: `"A rough guide to what you might owe. Always check with your accountant."`
3. Year selector: dropdown showing current and previous 2 tax years. Defaults to current year.
4. On load, fetch from `/api/reports/tax-estimate?year=YYYY`.
5. Show 4 cards in a 2×2 grid:
   - `"Total Earned"` — grossIncome
   - `"Tax-Deductible Expenses"` — totalExpenses
   - `"Taxable Income"` — taxableIncome (highlighted)
   - `"Set Aside"` — estimatedTax (highlighted in amber/yellow)
6. Below the cards, show a simple formula explanation:
   `Earned ($48,000) − Expenses ($6,200) = Taxable Income ($41,800) × 25% = Set Aside $10,450`
   Make this look like a receipt/calculation, not a wall of text.
7. Show a disclaimer banner (amber background): `"This is an estimate only and is not tax advice. Consult a qualified accountant before filing."`
8. Show a "Download Report" button (calls Task C.4).
9. Show a "Set my tax rate" link that opens the Business Profile settings.
10. Verify: Change year selector; totals update. Change tax rate in settings; estimate updates.

---

## Task C.4: P&L (Profit & Loss) report

**File:** `app/api/reports/profit-loss/route.ts` (new, GET, authenticated)

**Plan:**

1. Accept `?year=2025&month=` (if month provided, filter to that month; otherwise full year).
2. Compute:
   - Income section: paid invoices grouped by month. Columns: Month, Invoices Paid, Total Income.
   - Expenses section: expenses grouped by category. Columns: Category, Count, Total.
   - Summary: Total Income, Total Expenses, Net Profit, Tax Estimate.
3. Return structured JSON.

**File:** `app/(app)/reports/page.tsx` (new) — simple table rendering the P&L data.

**Plan:**

1. Add `"Reports"` to sidebar nav (can share space with Tax or be a sub-item).
2. Alternatively, add a "P&L Report" tab within the Tax page. Simpler than a separate route.
3. Table layout:

```
INCOME
Month         Invoices    Total
January       4           $4,200
February      3           $3,800
...           ...         ...
TOTAL INCOME              $48,000

EXPENSES BY CATEGORY
Category               Items    Total
Software & Subs        5        $1,200
Travel                 3        $800
...
TOTAL EXPENSES                  $6,200

NET PROFIT                      $41,800
ESTIMATED TAX (25%)             $10,450
```

4. Add a "Download as CSV" button. Use PapaParse (already in stack) to generate CSV client-side and trigger download.
5. Add a "Download as PDF" button for Pro/Agency users (lower priority — skip if complex).
6. Verify: P&L matches the numbers from the tax estimate. CSV downloads correctly.

---

## Task C.5: "Set aside" tracker (optional, Pro feature)

**File:** `prisma/schema.prisma` — add to `User` or `BusinessProfile`.

**Plan:**

1. Add `taxSavingsAmount Float @default(0)` to `BusinessProfile`.
2. On the Tax page, below the "Set Aside" card, show a small tracker: `"You've set aside: $2,000 of $10,450"`.
3. Add an inline input: `"Update savings amount"` with a save button (calls `PUT /api/business-profile`).
4. This is purely manual (user self-reports). No bank integration.
5. Gate under Pro plan. Free users see the tracker greyed out with "Upgrade to track your savings".
6. Verify: Update the amount; the tracker reflects the new value immediately.

---

---

# PHASE D: Quotes & Proposals

**Goal:** Let users send a quote before invoicing. Client approves → one click converts to invoice. Closes the "quote → invoice" loop that every freelancer needs.

**Plain English to users:** "Send a price estimate. When the client agrees, turn it into an invoice instantly."

**Simplicity rules:**

- A quote looks identical to an invoice. Same form, same line items, different status and terminology.
- The only difference: quotes have a status of `draft`, `sent`, `accepted`, `declined`, `expired`.
- When accepted, converting to invoice is one button: "Convert to Invoice".
- No separate configuration. No complex workflows.

---

## Task D.1: Prisma schema — Quote model

**File:** `prisma/schema.prisma`

**Plan:**

1. Add `Quote` model. It mirrors `Invoice` but has a quote-specific status and no reminder system.
2. Run `npx prisma db push`.
3. Verify the new table appears.

```prisma
model Quote {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quoteNumber    String?  // e.g. "Q-001"
  clientName     String
  clientEmail    String
  clientAddress  String?
  issueDate      DateTime @default(now())
  expiryDate     DateTime?
  status         String   @default("draft") // draft | sent | accepted | declined | expired
  amount         Float    // grand total (kept for quick display)
  subtotal       Float?
  totalTax       Float?
  currency       String   @default("USD")
  notes          String?
  sellerName     String?
  sellerAddress  String?
  sellerTaxId    String?
  paymentTerms   String?
  convertedToInvoiceId String? @unique // set when converted
  lineItems      QuoteLineItem[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model QuoteLineItem {
  id          String  @id @default(cuid())
  quoteId     String
  quote       Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  description String
  quantity    Float   @default(1)
  unitPrice   Float
  taxRate     Float?
  taxAmount   Float?
  total       Float
  sortOrder   Int     @default(0)
}
```

**Add relation to User:** `quotes Quote[]`

---

## Task D.2: Quote CRUD API routes

**Files:**

- `app/api/quotes/route.ts` — GET (list) + POST (create)
- `app/api/quotes/[id]/route.ts` — GET (single) + PUT (update) + DELETE

**Plan:**

1. `GET /api/quotes` — list all quotes for session user, sorted by `createdAt` desc. Include line items.
2. `POST /api/quotes` — create quote. Auto-generate quoteNumber: `"Q-" + zero-padded count`. Validate with Zod (reuse `invoiceLineItemSchema` from existing validations).
3. `GET /api/quotes/[id]` — return single quote with line items. Owner check.
4. `PUT /api/quotes/[id]` — update quote. Only allow if status is `draft`.
5. `DELETE /api/quotes/[id]` — delete quote. Only allow if status is `draft` or `declined`.
6. Verify: Create a quote via POST; fetch it back; verify quoteNumber is auto-generated.

---

## Task D.3: Convert quote to invoice

**File:** `app/api/quotes/[id]/convert/route.ts` (new, POST)

**Plan:**

1. Authenticate session.
2. Fetch quote by `[id]`; confirm `userId` matches; confirm status is `accepted` or `sent`.
3. Create a new `Invoice` record copying: clientName, clientEmail, clientAddress, amount, subtotal, totalTax, currency, notes, sellerName, sellerAddress, sellerTaxId, paymentTerms, lineItems.
4. Set invoice `status = "unpaid"`, `dueDate` = today + 30 days (or from business profile `defaultPaymentTerms`).
5. Set `quote.convertedToInvoiceId = invoice.id` and `quote.status = "accepted"`.
6. Return `{ invoiceId: invoice.id }`.
7. Verify: Convert a quote; the invoice appears in the invoices list; the quote shows `"Converted"` status.

---

## Task D.4: Quote list page

**File:** `app/(app)/quotes/page.tsx` (new server component)
**File:** `app/(app)/quotes/QuotesClient.tsx` (new client component)

**Plan:**

1. Add `"Quotes"` to sidebar nav between `"Invoices"` and `"Payments"`.
2. Page description: `"Price estimates you've sent. When a client agrees, turn it into an invoice in one click."`
3. Table columns: Date | Quote # | Client | Amount | Status (badge) | Actions
4. Status badges (coloured): `draft` (grey) | `sent` (blue) | `accepted` (green) | `declined` (red) | `expired` (orange)
5. Actions per row:
   - `draft`: Edit, Send (changes status to `sent`), Delete
   - `sent`: Convert to Invoice (status = `accepted`), Mark Declined, View
   - `accepted`: View (shows "Converted" badge and links to invoice)
   - `declined`: View, Delete
6. "+ New Quote" button at top right. Reuses the invoice form component (same UI, different endpoint and labels).
7. "Send" button: changes `status` to `sent` and (optional) sends an email via Resend with the quote as a PDF or HTML view. Email is optional for MVP.
8. Verify: Create a quote, send it, convert it to invoice. Verify invoice appears and quote shows "Converted".

---

## Task D.5: Client-facing quote view page

**File:** `app/quote/[quoteId]/page.tsx` (new, public route — no auth required)

**Plan:**

1. Fetch quote by `quoteId`. Show a 404 if not found.
2. Layout identical to the invoice preview page (`app/(app)/invoices/[id]/page.tsx`) but:
   - Heading: `"QUOTE"` instead of `"INVOICE"`.
   - Show `expiryDate` if set: `"This quote expires on [date]."`.
   - Two action buttons: `"✓ Accept Quote"` and `"✗ Decline"`.
3. "Accept Quote" calls `POST /api/quotes/[id]/respond` with `{ action: "accepted" }`.
4. "Decline" calls the same endpoint with `{ action: "declined" }`.
5. The endpoint: updates `quote.status`, sends a notification to the user (in-app notification or email via Resend).
6. After accepting: show a confirmation page: `"You've accepted the quote. [Business name] will be in touch with your invoice shortly."`
7. Verify: Open quote URL without being logged in; accept it; verify status updates in the dashboard.

---

---

# PHASE E: Time Tracking

**Goal:** Track hours spent on projects; generate an invoice from the tracked time in one click. Freelancers who bill hourly will use this daily.

**Plain English to users:** "Log your hours. When you're ready to bill, we'll add them up and create an invoice for you."

**Simplicity rules:**

- No complex project hierarchies. A time entry belongs to a client (by email) and has an optional description.
- Default hourly rate comes from business profile. Can be overridden per entry.
- The timer is a simple start/stop. No Pomodoro, no tags, no sub-tasks unless explicitly requested later.

---

## Task E.1: Prisma schema — TimeEntry model

**File:** `prisma/schema.prisma`

```prisma
model TimeEntry {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientEmail String
  clientName  String?
  description String?
  startTime   DateTime
  endTime     DateTime?
  durationMinutes Int?  // computed: set when endTime is set
  hourlyRate  Float?    // if null, use business profile rate
  invoiced    Boolean   @default(false)
  invoiceId   String?   // set when billed
  createdAt   DateTime  @default(now())
}
```

Add `defaultHourlyRate Float?` to `BusinessProfile`.

Add `timeEntries TimeEntry[]` to `User`.

Run `npx prisma db push`.

---

## Task E.2: Time tracking API routes

**Files:** `app/api/time/route.ts`, `app/api/time/[id]/route.ts`, `app/api/time/[id]/stop/route.ts`

**Plan:**

1. `GET /api/time` — list entries for session user. Query params: `?clientEmail=&invoiced=false&page=1`. Returns entries with duration formatted as `"X h Y min"`.
2. `POST /api/time` — start a timer. Create entry with `startTime = now()`, `endTime = null`.
3. `POST /api/time/[id]/stop` — set `endTime = now()`, compute `durationMinutes = (endTime - startTime) / 60000`.
4. `PUT /api/time/[id]` — manual edit (all fields, only if not invoiced).
5. `DELETE /api/time/[id]` — delete (only if not invoiced).
6. Verify: Start a timer; wait; stop it; verify `durationMinutes` is correct.

---

## Task E.3: Time tracking page

**File:** `app/(app)/time/page.tsx` (new)

**Plan:**

1. Add `"Time"` to the sidebar nav (between Expenses and Tax).
2. Page description: `"Track your hours. Bill your clients without the maths."`
3. Top section: **Active Timer** (if one is running, show elapsed time ticking in real-time; a "Stop" button). If none running, show a "Start Timer" button with fields: Client (dropdown of existing clients), Description (optional).
4. Table below: all unbilled time entries grouped by client. Columns: Date | Client | Description | Duration | Rate | Value | Actions.
5. At the bottom of each client group, show: `"Total: X hours — worth $Y"`. A "Create Invoice" button generates an invoice for that client with the unbilled hours as line items.
6. "Create Invoice" action:
   - Calls `POST /api/time/create-invoice`.
   - Creates an `Invoice` with `lineItems` populated from the time entries.
   - Marks each `TimeEntry.invoiced = true`, sets `invoiceId`.
   - Redirects to invoice preview.
7. Verify: Log 2 hours; click "Create Invoice"; invoice appears with correct line items and total.

---

## Task E.4: Add hourly rate to business profile settings

**File:** `app/(app)/settings/business/page.tsx`

**Plan:**

1. Add `"Default hourly rate"` input below the existing fields.
2. Include currency symbol prefix.
3. Save to `BusinessProfile.defaultHourlyRate`.
4. Verify: Set rate to $100/hr; create a 2-hour time entry; invoice total shows $200.

---

---

# PHASE F: Recurring Invoices & Retainers

**Goal:** Automatically create and send invoices on a schedule (weekly, monthly, etc.) for ongoing clients. This is the most-requested feature for retainer-based freelancers.

**Plain English to users:** "Set it up once. We'll send the invoice every month automatically."

**Simplicity rules:**

- One setup form. Pick a client, amount, and how often. Done.
- The system creates and optionally sends the invoice automatically on the schedule.
- User can pause, edit, or cancel at any time.

---

## Task F.1: Prisma schema — RecurringInvoice model

**File:** `prisma/schema.prisma`

```prisma
model RecurringInvoice {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientName      String
  clientEmail     String
  clientPhone     String?
  amount          Float
  currency        String    @default("USD")
  frequency       String    // "weekly" | "biweekly" | "monthly" | "quarterly" | "annually"
  dayOfMonth      Int?      // for monthly: which day (1-28)
  nextRunDate     DateTime
  endDate         DateTime? // if null, runs forever
  description     String?
  status          String    @default("active") // "active" | "paused" | "cancelled"
  autoSend        Boolean   @default(true)     // if true, sends email automatically; if false, creates draft
  reminderScheduleId String?
  invoicesCreated Int       @default(0)
  lastRunDate     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

Add `recurringInvoices RecurringInvoice[]` to `User`.

Run `npx prisma db push`.

---

## Task F.2: Recurring invoice CRUD API

**Files:** `app/api/recurring/route.ts`, `app/api/recurring/[id]/route.ts`

**Plan:**

1. `GET /api/recurring` — list all recurring invoices for session user.
2. `POST /api/recurring` — create a new recurring invoice. Compute `nextRunDate` from `frequency` and `dayOfMonth`. Zod validation.
3. `PUT /api/recurring/[id]` — update. Recompute `nextRunDate` if frequency or dayOfMonth changes.
4. `DELETE /api/recurring/[id]` — delete (or set status to `cancelled`).
5. Verify: Create a monthly recurring invoice; fetch it back; `nextRunDate` is the correct upcoming date.

**`nextRunDate` calculation logic:**

- `"monthly"`: first occurrence of `dayOfMonth` after today. If `dayOfMonth > 28`, cap at 28 to avoid Feb issues.
- `"weekly"`: today + 7 days.
- `"quarterly"`: today + 90 days.
- Use `date-fns` `addDays`, `addMonths`, `setDate`.

---

## Task F.3: Cron job to generate recurring invoices

**File:** `app/api/cron/process-recurring/route.ts` (new, protected with cron secret)

**Plan:**

1. Fetch all `RecurringInvoice` records where `status = "active"` and `nextRunDate <= today`.
2. For each:
   a. Create a new `Invoice` record copying fields from the template.
   b. Set `dueDate = today + 30 days` (or based on paymentTerms).
   c. If `autoSend = true`, call the existing reminder sending logic to send the first reminder email.
   d. Update `recurringInvoice.invoicesCreated += 1`, set `lastRunDate = today`.
   e. Compute and set the new `nextRunDate` based on `frequency`.
   f. If `endDate` is set and `nextRunDate > endDate`, set `status = "cancelled"`.
3. Return a summary: `{ processed: N, created: N, errors: [] }`.
4. Add to `vercel.json` crons: `"0 6 * * *"` (runs at 6am UTC daily).
5. Verify: Manually call the endpoint with today's date; verify invoices are created.

---

## Task F.4: Recurring invoices page

**File:** `app/(app)/recurring/page.tsx` (new)

**Plan:**

1. Add `"Recurring"` to sidebar nav between `"Invoices"` and `"Quotes"`.
2. Page description: `"Invoices that send themselves. Perfect for monthly retainers."`
3. Table: Client | Amount | Frequency | Next Invoice | Status | Actions.
4. Status badges: `active` (green), `paused` (yellow), `cancelled` (grey).
5. Actions: Edit, Pause/Resume, Cancel.
6. `"+ Set Up Recurring Invoice"` button opens a form:
   - Client name + email
   - Amount
   - Frequency (dropdown: Weekly / Every 2 weeks / Monthly / Quarterly / Annually)
   - Day of month (shown only for Monthly/Quarterly — number 1–28)
   - First invoice date (date picker, default next occurrence)
   - Description (optional)
   - "Send automatically?" toggle (default on)
7. Verify: Create a monthly recurring; pause it; resume it; verify `nextRunDate` is correct.

---

---

# PHASE G: Multi-Currency

**Goal:** Let users invoice clients in any currency. Display amounts in the correct currency. Show the user's own totals in their base currency.

**Plain English to users:** "Invoice your US client in dollars and your UK client in pounds. We'll keep track of both."

**Simplicity rules:**

- Currency is set per-invoice. There's no automatic conversion for now (that requires live exchange rates and is Phase G.2).
- All dashboard totals show a note: `"Shown in your base currency (USD). Amounts in other currencies are shown as-is."`
- Currency is a 3-letter ISO code. Show the symbol where known (USD=$, EUR=€, GBP=£, etc.).

---

## Task G.1: Ensure currency is stored everywhere

**Files:** `prisma/schema.prisma`

**Plan:**

1. Confirm `Invoice`, `Quote`, `Expense`, `RecurringInvoice`, `TimeEntry` all have a `currency String @default("USD")` field. Add where missing.
2. Add `baseCurrency String @default("USD")` to `BusinessProfile`.
3. Run `npx prisma db push`.
4. Verify: All relevant tables have the `currency` field.

---

## Task G.2: Currency selector in invoice form

**File:** `app/components/InvoiceForm.tsx`

**Plan:**

1. Add a `currency` field to the invoice form. Place it next to the Amount field.
2. Use a `<select>` populated from a static list of common currencies:
   `USD, EUR, GBP, AUD, CAD, SGD, ZAR, INR, NZD, CHF, JPY, BRL, MXN`.
3. Default to `user.businessProfile.baseCurrency` (or `"USD"` if not set).
4. Display the currency symbol in the Amount field prefix based on the selected currency. Use a simple lookup map:
   ```ts
   const SYMBOLS: Record<string, string> = {
     USD: "$",
     EUR: "€",
     GBP: "£",
     AUD: "A$",
     CAD: "C$",
     SGD: "S$",
     ZAR: "R",
     INR: "₹",
     JPY: "¥",
     CHF: "Fr",
   };
   ```
5. Verify: Change currency dropdown; amount prefix updates. Save invoice; currency is stored correctly.

---

## Task G.3: Currency display in lists and dashboard

**File:** All components that display amounts: `InvoiceTable.tsx`, dashboard widgets, `ExpensesClient.tsx`, etc.

**Plan:**

1. Create a shared utility `lib/format-currency.ts`:
   ```ts
   export function formatCurrency(
     amount: number,
     currency: string = "USD",
   ): string {
     return new Intl.NumberFormat("en-US", {
       style: "currency",
       currency,
       minimumFractionDigits: 2,
     }).format(amount);
   }
   ```
2. Replace all raw `$${amount.toFixed(2)}` formatting with `formatCurrency(amount, invoice.currency)`.
3. On the dashboard totals, if a user has invoices in multiple currencies, show a note below each total: `"Amounts shown as invoiced (no conversion applied)."`.
4. Verify: Create invoices in USD and EUR; the list shows correct symbols for each.

---

---

# PHASE H: Client Portal 2.0

**Goal:** Give each client a private portal where they can see all their invoices, quotes, and payment history. No login required — access via a magic link.

**Plain English to users:** "Send your client a link. They can see everything you've sent them in one place."

**Simplicity rules:**

- The portal is read-only for the client. They can pay and accept/decline quotes. Nothing else.
- No separate client accounts or passwords. Magic link only (emailed to the client).
- The portal URL is `yourapp.com/portal/[token]`.

---

## Task H.1: Prisma schema — ClientPortalToken

**File:** `prisma/schema.prisma`

```prisma
model ClientPortalToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientEmail String
  token       String   @unique @default(cuid())
  expiresAt   DateTime // 90 days from creation
  lastAccessedAt DateTime?
  createdAt   DateTime @default(now())

  @@unique([userId, clientEmail])
}
```

Add `clientPortalTokens ClientPortalToken[]` to `User`.

Run `npx prisma db push`.

---

## Task H.2: Portal token generation API

**File:** `app/api/portal/generate/route.ts` (new, POST, authenticated)

**Plan:**

1. Accept `{ clientEmail: string }` in body.
2. Upsert a `ClientPortalToken` for `(userId, clientEmail)`. Refresh `token` and `expiresAt = now + 90 days` each time.
3. Send an email via Resend to the `clientEmail` with the portal link: `https://yourapp.com/portal/[token]`.
4. Return `{ portalUrl: string }`.
5. Verify: Call the endpoint; verify token is in the database; verify email is sent (check Resend logs).

---

## Task H.3: Portal page

**File:** `app/portal/[token]/page.tsx` (new, public route)

**Plan:**

1. Fetch the token from the database. If not found or expired (`expiresAt < now`), show: `"This link has expired. Ask your contact to send you a new one."`.
2. Update `lastAccessedAt = now`.
3. Load all invoices and quotes for `(token.userId, token.clientEmail)`.
4. Render a clean, professional page (no Invoice Nudger branding unless white-label is off):
   - Heading: `"Your Account with [BusinessName]"`
   - Summary row: Total Owed | Total Paid | Outstanding
   - Tabs: "Invoices" | "Quotes" | "History"
5. Invoices tab: table of all invoices (date, description, amount, status). Unpaid invoices show a "Pay Now" button linking to the Stripe Payment Link.
6. Quotes tab: pending quotes show "Accept" and "Decline" buttons (calls existing quote respond API).
7. History tab: all paid invoices.
8. Verify: Generate a token for a client email; open the URL; verify their invoices appear. Pay one; verify it's marked paid.

---

---

# PHASE I: Basic Accounting (P&L + Balance Overview)

**Goal:** A single "Accounting" page that gives a real freelancer or SME owner everything they need to understand their financial position, without needing a spreadsheet or accountant for day-to-day.

**Plain English to users:** "Your money in, money out, and what's left over — all in one place."

**Simplicity rules:**

- Only show what matters. No debits, credits, journals, or double-entry ledger.
- Drill down is available but never forced.
- Export to CSV is always available.

---

## Task I.1: Accounting overview page

**File:** `app/(app)/accounting/page.tsx` (new)

**Plan:**

1. Add `"Accounting"` to the sidebar nav. Place it last before Settings.
2. Page description: `"Your full financial picture. Income, expenses, profit, and tax — all in one place."`
3. Year selector at the top (default current year). Month filter (optional: "Full Year" or a specific month).
4. Four summary tiles (large):
   - **Total Income** (paid invoices)
   - **Total Expenses** (all expenses)
   - **Net Profit** = Income - Expenses
   - **Estimated Tax** (from tax estimate API)
5. Below the tiles, show 3 collapsible sections:

**Section 1: Income Breakdown**
Table: Month | Invoices | Amount | % of Annual Total
Bar chart (Recharts): monthly income bar chart.

**Section 2: Expense Breakdown**
Table: Category | Items | Amount | % of Total
Pie or donut chart: expense by category.

**Section 3: Cash Flow (simplified)**
Line chart: monthly income vs monthly expenses over the year.

6. Export button: downloads a full-year CSV with all invoices + expenses.
7. Verify: With invoices and expenses seeded, all tiles show correct values. Charts render without error.

---

## Task I.2: Export to accountant (CSV)

**File:** `app/api/reports/export/route.ts` (new, GET, authenticated)

**Plan:**

1. Accept `?year=2025&format=csv`.
2. Build two sections in the CSV:
   - All paid invoices (date, invoice #, client, amount, currency, tax)
   - All expenses (date, vendor, category, amount, taxDeductible)
3. Use PapaParse (already installed) to generate CSV on the server.
4. Return with `Content-Disposition: attachment; filename="finances-2025.csv"`.
5. Verify: Download the CSV; open in Google Sheets; verify headers and data are correct.

---

---

# PHASE J: Mobile-First PWA

**Goal:** Make Invoice Nudger installable on a phone and fast on mobile. This is a polish phase — no new features, just PWA setup and mobile layout fixes.

**Plain English to users:** "Add it to your home screen and use it just like an app."

---

## Task J.1: Add PWA manifest and service worker

**File:** `public/manifest.json` (new)

**Plan:**

1. Create `manifest.json`:
   ```json
   {
     "name": "Invoice Nudger",
     "short_name": "Nudger",
     "start_url": "/dashboard",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#4f46e5",
     "icons": [
       { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
     ]
   }
   ```
2. Add `<link rel="manifest" href="/manifest.json" />` to `app/layout.tsx` `<head>`.
3. Add `<meta name="theme-color" content="#4f46e5" />` to `<head>`.
4. Create placeholder icons (192×192 and 512×512 PNGs) in `/public`. Can use a simple logo or letter "N" for now.
5. Verify: Open in Chrome on mobile; "Add to Home Screen" prompt appears or is available via browser menu.

---

## Task J.2: Mobile layout audit and fixes

**Files:** All page and layout components.

**Plan:**

1. Open each main page on a 390px-wide viewport (iPhone 14 equivalent) in DevTools.
2. For each page, check:
   - Tables: wrap in a horizontal scroll container (`overflow-x-auto`) if they overflow.
   - Forms: inputs should be full-width (`w-full`) on mobile.
   - Sidebar: should collapse to a bottom nav or hamburger on mobile. (If already implemented, verify. If not, add a hamburger menu that slides the sidebar in from the left.)
   - Stat cards: stack vertically (single column) on mobile.
3. Fix any layout overflows or clipped text.
4. Verify: Every main page is usable on a 390px viewport without horizontal scroll on the main content.

---

---

## Updated Roadmap Overview

**Implementation order:** K and L first — contracts close the quote→invoice pipeline; income allocation is the emotional core of the product. Then M and N (bank import + email receipts) for data automation. Then Q and R (accountant + team access) to unlock Agency tier upgrades. Then O, P, S, T.

---

# PHASE K: Contracts & E-Signature

**Goal:** Let users send a simple service contract to a client before or after a quote. Client signs with a typed name. Signed contract is stored as a PDF. One click from an accepted quote.

**Plain English to users:** "Protect yourself before you start work. Send a contract, get it signed, then invoice."

**Simplicity rules:**

- No lawyer-grade complexity. A few templates. Fill in the blanks. Send.
- E-signature = typed full name + checkbox + timestamp. Valid in most jurisdictions for this contract type.
- Don't build a document editor. A simple template with editable fields is enough.

---

## Task K.1: Prisma schema — Contract model

**File:** `prisma/schema.prisma`

**Plan:**

1. Add `Contract` and `ContractTemplate` models.
2. Run `npx prisma db push`.
3. Verify new tables appear in Prisma Studio.

```prisma
model ContractTemplate {
  id        String     @id @default(cuid())
  userId    String?    // null = system default template
  user      User?      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String     // e.g. "Freelance Service Agreement"
  body      String     @db.Text  // HTML or markdown with {{variables}}
  isDefault Boolean    @default(false)
  contracts Contract[]
  createdAt DateTime   @default(now())
}

model Contract {
  id           String            @id @default(cuid())
  userId       String
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  templateId   String?
  template     ContractTemplate? @relation(fields: [templateId], references: [id])
  quoteId      String?           @unique
  invoiceId    String?
  clientName   String
  clientEmail  String
  title        String
  body         String            @db.Text   // final rendered content
  status       String            @default("draft") // draft | sent | signed | declined
  signingToken String            @unique @default(cuid())
  signedAt     DateTime?
  signedByName String?           // typed name from client
  signedByIp   String?
  pdfUrl       String?           // stored after signing
  sentAt       DateTime?
  expiresAt    DateTime?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
}
```

Add to `User`: `contracts Contract[]`, `contractTemplates ContractTemplate[]`

---

## Task K.2: Seed system contract templates

**File:** `prisma/seed.ts` (or equivalent seeding script)

**Plan:**

1. Create 3 system-level `ContractTemplate` records (userId = null) on first deploy:
   - `"Freelance Service Agreement"` — general purpose.
   - `"Retainer Agreement"` — for recurring/monthly clients.
   - `"Project-Based Agreement"` — fixed scope, fixed price.
2. Each template body uses `{{variables}}` for: `{{clientName}}`, `{{serviceDescription}}`, `{{amount}}`, `{{paymentTerms}}`, `{{startDate}}`, `{{yourName}}`, `{{yourBusinessName}}`.
3. Write the actual template text for each. Keep them short (1 page). Plain English, no legalese.
4. Verify: After seeding, query `ContractTemplate` and see 3 rows with `userId = null`.

---

## Task K.3: Contract CRUD API

**Files:**

- `app/api/contracts/route.ts` — GET (list) + POST (create)
- `app/api/contracts/[id]/route.ts` — GET + PUT + DELETE
- `app/api/contracts/[id]/send/route.ts` — POST (send to client)

**Plan:**

1. `GET /api/contracts` — list all contracts for session user, sorted by `createdAt` desc.
2. `POST /api/contracts` — create a contract. Accept `{ templateId, clientName, clientEmail, variables: Record<string, string> }`. Render the template body by replacing `{{variable}}` tokens with supplied values. Store rendered body in `Contract.body`.
3. `PUT /api/contracts/[id]` — update body or metadata. Only if `status = "draft"`.
4. `DELETE /api/contracts/[id]` — only if `status = "draft"`.
5. `POST /api/contracts/[id]/send` — set `status = "sent"`, `sentAt = now()`. Send email via Resend to `clientEmail` with the signing URL: `https://yourapp.com/sign/[signingToken]`. Return `{ signingUrl }`.
6. Verify: Create a contract from template; send it; confirm email is dispatched and status updates.

---

## Task K.4: Client-facing signing page

**File:** `app/sign/[token]/page.tsx` (new, public route)

**Plan:**

1. Fetch `Contract` by `signingToken`. Show 404 if not found.
2. If `status = "signed"`, show: `"This contract has already been signed."` with the signed date and name.
3. If `expiresAt` is set and past, show: `"This contract has expired."`.
4. Render the contract body (use `dangerouslySetInnerHTML` or a markdown renderer depending on body format). Style it to look like a real document — clean, professional, printable.
5. Below the contract, show the signing form:
   - Checkbox: `"I have read and agree to the terms above."`
   - Text input: `"Type your full legal name to sign"`
   - Button: `"Sign Contract"`
6. On submit, call `POST /api/contracts/[id]/sign` (Task K.5).
7. After signing, show a confirmation: `"Signed. A copy has been sent to your email."` and a download PDF button.
8. Verify: Open signing URL in incognito; sign with a test name; confirm status updates to `"signed"`.

---

## Task K.5: Sign endpoint + PDF generation

**File:** `app/api/contracts/[id]/sign/route.ts` (new, public — no auth required)

**Plan:**

1. Accept `{ token, signedByName }` in the POST body.
2. Validate: `token` matches `contract.signingToken`; `status` is `"sent"`; contract not expired.
3. Capture `signedByIp` from the request headers (`x-forwarded-for` or `cf-connecting-ip`).
4. Generate a simple PDF of the contract using `puppeteer` (headless) or `@react-pdf/renderer`. Append a signature block at the bottom: `"Signed by: [name] on [date] from IP [ip]"`.
5. Upload PDF to Supabase Storage bucket `contracts`. Store the URL in `contract.pdfUrl`.
6. Update: `status = "signed"`, `signedAt = now()`, `signedByName`, `signedByIp`.
7. Send confirmation email via Resend to both the client and the user (owner) with a PDF attachment.
8. If `contract.quoteId` is set, update the linked quote status to `"accepted"`.
9. Trigger an in-app notification for the user: `"[ClientName] signed your contract."`.
10. Verify: Sign a contract; check the PDF is stored; check both emails are sent.

---

## Task K.6: Contracts page

**File:** `app/(app)/contracts/page.tsx` (new)

**Plan:**

1. Add `"Contracts"` to sidebar nav between `"Quotes"` and `"Recurring"`.
2. Page description: `"Protect yourself before work starts. Send a contract, get it signed in minutes."`
3. Table columns: Date | Client | Contract Title | Status | Signed Date | Actions.
4. Status badges: `draft` (grey), `sent` (blue), `signed` (green), `declined` (red), `expired` (orange).
5. Actions: View (opens document), Send (if draft), Download PDF (if signed), Delete (if draft).
6. `"+ New Contract"` button opens a 3-step form:
   - Step 1: Choose a template (show template cards with names and one-line descriptions).
   - Step 2: Fill in the variables (generated from `{{variable}}` tokens in the template). Show each as a labelled input.
   - Step 3: Preview the rendered contract. "Send to Client" button.
7. Add a `"Send Contract"` shortcut on the Quote detail page: if quote is `accepted`, show `"→ Send Contract"` button that pre-fills the contract form with the quote's client details and amount.
8. Verify: Full flow — new contract → fill variables → preview → send → client signs → status updates → PDF accessible.

---

---

# PHASE L: Income Allocation (Profit First)

**Goal:** Every time a payment lands, automatically show the user how to split it: taxes, business operating costs, profit, and personal pay. Based on the Profit First methodology. No accounting knowledge required.

**Plain English to users:** "When money comes in, we'll tell you exactly how to split it — so you never accidentally spend your tax money."

**Simplicity rules:**

- The default split is pre-set (sensible defaults). The user can adjust percentages.
- This is a calculator and tracker, not a bank account feature. No actual money movement (Phase O handles payouts).
- One screen. Four buckets. One number (total received). Done.

---

## Task L.1: Prisma schema — AllocationProfile + AllocationRecord

**File:** `prisma/schema.prisma`

**Plan:**

1. Add `AllocationProfile` (the user's configured percentages) and `AllocationRecord` (a log entry per payment received).
2. Run `npx prisma db push`.

```prisma
model AllocationProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  taxPercent      Float    @default(25)   // % of income to set aside for tax
  operatingPercent Float   @default(30)  // % for business expenses
  profitPercent   Float    @default(5)    // % kept as business profit buffer
  ownerPayPercent Float    @default(40)  // % to pay yourself
  // Must sum to 100. Validate on save.
  currency        String   @default("USD")
  updatedAt       DateTime @updatedAt
}

model AllocationRecord {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  invoiceId        String?  // linked invoice that triggered this
  totalReceived    Float
  taxAmount        Float
  operatingAmount  Float
  profitAmount     Float
  ownerPayAmount   Float
  currency         String   @default("USD")
  note             String?
  createdAt        DateTime @default(now())
}
```

Add to `User`: `allocationProfile AllocationProfile?`, `allocationRecords AllocationRecord[]`

---

## Task L.2: Allocation profile API

**File:** `app/api/allocation/profile/route.ts` (new, GET + PUT, authenticated)

**Plan:**

1. `GET /api/allocation/profile` — return the user's `AllocationProfile`. If none exists, return defaults: `{ tax: 25, operating: 30, profit: 5, ownerPay: 40 }`.
2. `PUT /api/allocation/profile` — update the profile. Validate that all four percentages sum to exactly 100. If not, return `400` with: `"Percentages must add up to 100. Currently: X."`.
3. Upsert on every PUT (create if not exists, update if it does).
4. Verify: Set percentages; fetch back; confirm they saved. Try saving percentages that don't sum to 100; confirm error is returned.

---

## Task L.3: Trigger allocation record on payment received

**File:** `app/api/webhooks/stripe/route.ts` (existing Stripe webhook handler)

**Plan:**

1. In the `invoice.payment_succeeded` (or `checkout.session.completed`) webhook handler, after marking the invoice as paid, call a new utility function `createAllocationRecord(userId, amount, currency, invoiceId)`.
2. `createAllocationRecord` (new file: `lib/allocation.ts`):
   - Fetch the user's `AllocationProfile` (or use defaults if none).
   - Compute each bucket amount: `taxAmount = totalReceived * (taxPercent / 100)`, etc.
   - Create an `AllocationRecord`.
   - Trigger an in-app notification: `"$X received from [Client]. Here's your split: $Y to tax, $Z to you."`.
3. Verify: Trigger a test Stripe webhook; check an `AllocationRecord` is created with correct amounts.

---

## Task L.4: Income allocation page

**File:** `app/(app)/money/page.tsx` (new — route name "money" is deliberately plain)

**Plan:**

1. Add `"My Money"` to sidebar nav between `"Expenses"` and `"Tax"`.
2. Page description: `"Every time you get paid, here's where it goes. Set it once, forget it."`
3. Top section — **Your Split**: show 4 editable percentage inputs in a row:
   - 🏦 Tax (default 25%)
   - 🏢 Business (default 30%)
   - 💰 Profit (default 5%)
   - 🙋 Me (default 40%)
   - Below the inputs, a live-updating note: `"These add up to [X]%."` Red if not 100, green if exactly 100.
   - `"Save my split"` button (calls PUT `/api/allocation/profile`).
4. Middle section — **Recent Payments**: a list of `AllocationRecord` entries, most recent first. Each row shows: Date | Invoice | Total | Tax | Business | Profit | Me. Like a receipt breakdown.
5. Bottom section — **Running Totals (This Year)**:
   - Total Received: `$X`
   - Set Aside for Tax: `$Y`
   - Kept in Business: `$Z`
   - Paid to Yourself: `$W`
   - Profit Buffer: `$V`
6. Add a widget on the Dashboard: `"Your next pay yourself amount"` — shows the most recent allocation's `ownerPayAmount` with a note: `"Based on your last payment."`.
7. Verify: Receive a test payment; navigate to `/money`; confirm the split appears correctly with the right amounts.

---

## Task L.5: "What if?" allocation calculator

**File:** `app/(app)/money/page.tsx` — add a collapsible section at the bottom.

**Plan:**

1. Add a `"Calculate a payment"` section (collapsed by default, expand on click).
2. A single input: `"If I receive: $[amount]"`.
3. On input, show a live breakdown using the user's saved percentages:
   ```
   Tax (25%)        → $250
   Business (30%)   → $300
   Profit (5%)      → $50
   Me (40%)         → $400
   ```
4. No save button. This is just a calculator — pure client-side maths.
5. Verify: Enter $1,000; confirm breakdown matches percentages exactly.

---

---

# PHASE M: Automated Bank Import

**Goal:** Connect the user's bank account so transactions are automatically pulled in. Match bank transactions to existing invoices and expenses. Eliminate manual data entry.

**Plain English to users:** "Connect your bank once. We'll pull in your transactions and match them to your invoices automatically."

**Simplicity rules:**

- Bank credentials never touch your server. Use a regulated provider (Plaid for US/CA, TrueLayer for UK/EU).
- Matching is automatic but the user confirms before anything is marked as paid.
- If no match is found, transaction goes to "unmatched" — user can assign it to an expense or ignore it.

---

## Task M.1: Choose and configure bank connection provider

**Decision (log in MEMORY.md):**

- US/Canada users: use **Plaid** (`plaid` npm package). Requires Plaid account + API keys in `.env`.
- UK/EU users: use **TrueLayer** (`truelayer-client` or REST calls). Requires TrueLayer account + API keys.
- For MVP: implement Plaid only. TrueLayer is Task M.6 (extension).

**Environment variables to add to `.env`:**

```
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox  # sandbox | development | production
```

**Plan:**

1. Install Plaid SDK: `npm install plaid`.
2. Verify: Import `PlaidApi` from `plaid` in a test file; no TypeScript errors.

---

## Task M.2: Prisma schema — BankConnection + BankTransaction

**File:** `prisma/schema.prisma`

```prisma
model BankConnection {
  id               String            @id @default(cuid())
  userId           String
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider         String            @default("plaid") // "plaid" | "truelayer"
  accessToken      String            // encrypted — never expose to client
  itemId           String?           // Plaid item ID
  institutionName  String?
  accountName      String?
  accountMask      String?           // last 4 digits
  status           String            @default("active") // active | error | disconnected
  lastSyncAt       DateTime?
  createdAt        DateTime          @default(now())
  transactions     BankTransaction[]
}

model BankTransaction {
  id               String          @id @default(cuid())
  userId           String
  user             User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  connectionId     String
  connection       BankConnection  @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  externalId       String          @unique  // Plaid transaction ID — prevents duplicates
  date             DateTime        @db.Date
  description      String
  amount           Float           // positive = money in, negative = money out
  currency         String          @default("USD")
  category         String?         // from Plaid's categorisation
  matchedInvoiceId String?         // set when matched to an invoice
  matchedExpenseId String?         // set when matched to an expense
  status           String          @default("unmatched") // unmatched | matched | ignored
  createdAt        DateTime        @default(now())
}
```

Add to `User`: `bankConnections BankConnection[]`, `bankTransactions BankTransaction[]`

Run `npx prisma db push`.

---

## Task M.3: Plaid Link — connect a bank account

**Files:**

- `app/api/bank/link-token/route.ts` (new, POST, authenticated)
- `app/api/bank/exchange-token/route.ts` (new, POST, authenticated)

**Plan:**

1. `POST /api/bank/link-token`: call `plaidClient.linkTokenCreate()` with the user's ID. Return the `link_token` to the client. This token is used to open the Plaid Link UI.
2. On the client, use the Plaid Link browser SDK (`react-plaid-link` package) to open the bank connection modal. On success, Plaid returns a `public_token`.
3. `POST /api/bank/exchange-token`: accept `{ publicToken, metadata }`. Call `plaidClient.itemPublicTokenExchange()` to get an `access_token`. **Encrypt** the access token before storing (use `crypto.createCipheriv` with `ENCRYPTION_KEY` from env). Store a new `BankConnection` record. Return `{ success: true, institutionName, accountMask }`.
4. Add `ENCRYPTION_KEY` (32-byte hex string) to `.env`.
5. Verify: Complete the Plaid sandbox flow; confirm a `BankConnection` row is created with an encrypted access token.

---

## Task M.4: Sync bank transactions (cron)

**File:** `app/api/cron/sync-bank/route.ts` (new, protected with cron secret)

**Plan:**

1. Fetch all `BankConnection` records where `status = "active"`.
2. For each connection:
   a. Decrypt the `accessToken`.
   b. Call `plaidClient.transactionsSync()` with the access token (or `transactionsGet` with a date range: last 30 days).
   c. For each returned transaction, upsert into `BankTransaction` using `externalId` as the unique key (prevents duplicates on re-sync).
   d. After upsert, call `autoMatchTransaction(transaction)` (Task M.5).
   e. Update `connection.lastSyncAt = now()`.
3. Add to `vercel.json` crons: run every 6 hours `"0 */6 * * *"`.
4. Verify: Run the cron manually in sandbox mode; confirm transactions appear in the `BankTransaction` table.

---

## Task M.5: Auto-matching logic

**File:** `lib/bank-matching.ts` (new utility)

**Plan:**

1. `autoMatchTransaction(transaction: BankTransaction)`:
   - If `transaction.amount > 0` (money in): query `Invoice` records for this `userId` where `status = "unpaid"` and `amount ≈ transaction.amount` (within ±1% tolerance) and `dueDate` within ±14 days of `transaction.date`. If exactly one match found, set `matchedInvoiceId` and `status = "matched"` on the transaction. Do NOT mark the invoice as paid yet — that requires user confirmation.
   - If `transaction.amount < 0` (money out): query `Expense` records for this `userId` where `amount ≈ Math.abs(transaction.amount)` and `date` within ±3 days. If exactly one match found, set `matchedExpenseId` and `status = "matched"`.
   - If no match: leave `status = "unmatched"`. Create an in-app notification if it's a credit (money in) > $100.
2. Verify: Create an unpaid invoice for $500; insert a matching bank transaction; run `autoMatchTransaction`; confirm `matchedInvoiceId` is set.

---

## Task M.6: Bank transactions review page

**File:** `app/(app)/bank/page.tsx` (new)

**Plan:**

1. Add `"Bank"` to sidebar nav between `"Expenses"` and `"My Money"`. Show only if the user has at least one `BankConnection`.
2. If no bank connected yet, show an empty state: `"Connect your bank to automatically import transactions."` with a `"Connect Bank"` button.
3. `"Connect Bank"` button triggers the Plaid Link flow (Task M.3). On completion, show a success toast.
4. Transaction list (tabs): `"To Review"` | `"Matched"` | `"Ignored"`.
5. **To Review tab**: unmatched transactions. Each row: Date | Description | Amount | Suggested Match (if any) | Actions.
   - If `matchedInvoiceId` is set: show `"Match to Invoice #X — $Y"` with a `"Confirm"` button. Confirming calls `POST /api/bank/confirm-match/[transactionId]` which marks the invoice as paid and the transaction as matched.
   - If no match: show `"Add as Expense"` button (pre-fills expense form) and `"Ignore"` button.
6. **Matched tab**: confirmed matches. Shows which invoice or expense each transaction was matched to.
7. **Ignored tab**: transactions the user dismissed. Can be un-ignored.
8. Show connected bank name and last sync time at the top. `"Sync Now"` button calls `POST /api/bank/sync` (manual trigger of the sync cron logic for this user only).
9. Verify: Connect sandbox bank; transactions appear in "To Review"; confirm a match; invoice status updates to paid.

---

---

# PHASE N: Email Receipts to Account

**Goal:** Give each user a unique email address. When they forward a receipt email to it, the app automatically creates an expense record. No manual data entry.

**Plain English to users:** "Got a receipt in your email? Forward it here. We'll log it automatically."

**Simplicity rules:**

- The user's receipt email is shown prominently in Settings and on the Expenses page.
- Parsing is best-effort. If the app can't extract an amount, it creates a draft expense that the user reviews.
- Never delete or bounce an email — always create something, even if incomplete.

---

## Task N.1: Assign receipt email addresses

**File:** `prisma/schema.prisma` — add to `User`.

**Plan:**

1. Add `receiptEmail String? @unique` to `User`. Format: `receipts.[userid]@mail.invoicenudger.com` (or whatever your sending domain is).
2. On user creation (or in a one-time migration), generate and store this address for all existing users.
3. Write a migration script: for all `User` records where `receiptEmail` is null, set `receiptEmail = "receipts." + user.id + "@mail.yourdomain.com"`.
4. Run `npx prisma db push`, then run the migration script.
5. Verify: All users have a unique `receiptEmail`.

---

## Task N.2: Inbound email webhook (Resend or Postmark)

**Decision (log in MEMORY.md):** Use Resend's inbound email feature (if available on your plan) or switch inbound processing to **Postmark** (which has a mature inbound webhook). Postmark sends a POST to your endpoint for every email received at a configured address.

**File:** `app/api/webhooks/inbound-email/route.ts` (new, POST, no user auth — verified by webhook secret)

**Plan:**

1. Configure your email provider to route all emails to `receipts.*@mail.yourdomain.com` to this webhook endpoint.
2. The webhook payload contains: `from`, `to`, `subject`, `text` body, `html` body, `attachments` (array of base64-encoded files).
3. Extract the `userId` from the `to` address: parse `receipts.[userId]@...` → `userId`.
4. Fetch the `User` by `userId`. If not found, return 200 (don't bounce).
5. Call `parseReceiptEmail(payload)` (Task N.3) to extract expense data.
6. Create an `Expense` record (status: `"draft"` if parsing was incomplete, `"confirmed"` if all fields were extracted).
7. Send an in-app notification: `"Receipt received from [sender]. Review it in Expenses."`.
8. Verify: Send a test email with a PDF attachment to the webhook (via ngrok in dev); confirm an expense draft is created.

---

## Task N.3: Receipt parsing utility

**File:** `lib/receipt-parser.ts` (new)

**Plan:**

1. `parseReceiptEmail(payload)` → returns `{ amount, vendor, date, description, confidence }`:
   - First, try to extract from email **subject line** using regex patterns: look for currency amounts (`$123.45`, `£99`, `€200.00`), vendor names (first capitalised word after "from" or "receipt from"), and dates.
   - Then, try the **text body**: same patterns, scan first 500 characters.
   - For **PDF attachments**: call AWS Textract (or a cheaper alternative: `pdf-parse` npm package for text-based PDFs). Extract text and run the same regex patterns.
   - For **image attachments** (JPEG/PNG): optionally call AWS Textract's `DetectDocumentText`. This is the most accurate but costs money per call. Make it configurable via `ENABLE_OCR_PARSING=true` in env.
2. Return a `confidence` score: `"high"` (amount + vendor found), `"medium"` (amount only), `"low"` (nothing reliable found).
3. If `confidence = "low"`, still create the expense as a draft with `description = email.subject` and `amount = 0` so the user can fill it in.
4. Verify: Test with 3 real receipt emails (a SaaS subscription, an Amazon order, a restaurant receipt). Confirm at least the amount is extracted correctly for each.

---

## Task N.4: Receipt email address in UI

**Files:** `app/(app)/settings/page.tsx`, `app/(app)/expenses/ExpensesClient.tsx`

**Plan:**

1. In Settings, add a section `"Receipt Email"`:
   - Show the user's receipt email in a copyable text box.
   - Instruction text: `"Forward any receipt email to this address. We'll log it as an expense automatically."`
   - `"Copy address"` button.
2. On the Expenses page, add a small banner (shown only to users with 0 expenses): `"📧 Forward receipts to [receiptEmail] to log them automatically."` Dismissable.
3. Verify: Copy the receipt email from settings; forward a test email; expense draft appears within 30 seconds.

---

---

# PHASE O: Instant Payouts

**Goal:** Let users request immediate access to funds from a paid invoice rather than waiting for standard bank settlement (typically 2–5 days). Powered by Stripe Instant Payouts.

**Plain English to users:** "Get paid now, not in 3 days."

**Simplicity rules:**

- This is a Stripe feature surfaced through your UI. Don't build the payout infrastructure — just the button.
- Show the fee clearly before confirming: `"Instant payout: $970 (1% fee = $10). Standard payout: $980, arrives in 2 days."`
- Pro/Agency only.

---

## Task O.1: Verify Stripe account eligibility

**File:** No code — configuration task.

**Plan:**

1. Log into your Stripe Dashboard.
2. Confirm Instant Payouts is enabled for your Stripe Connect account or platform. (Requires Stripe verification; not available in all countries.)
3. Log the finding in `MEMORY.md`: whether Instant Payouts is available and which countries are supported.
4. If not available for your account type, log: `"Instant Payouts requires Stripe Connect with a verified business. Implement Connect onboarding first."` and skip to Task O.2 as a prerequisite.

---

## Task O.2: Instant payout API route

**File:** `app/api/payouts/instant/route.ts` (new, POST, authenticated, Pro/Agency only)

**Plan:**

1. Gate: check `user.plan`. If `"free"`, return 403 with `"Upgrade to Pro to use Instant Payouts."`.
2. Accept `{ amount, currency }` in body (the amount the user wants to pay out).
3. Call `stripe.payouts.create({ amount, currency, method: "instant" })` using the user's connected Stripe account ID.
4. On success, return `{ payoutId, amount, fee, arrivalTime }`.
5. On error, return the Stripe error message plainly (e.g., `"Insufficient balance"`, `"Instant payouts not supported for this account"`).
6. Log the payout as an `AllocationRecord` adjustment if applicable.
7. Verify: Call the endpoint in Stripe test mode; confirm a payout object is created in the Stripe dashboard.

---

## Task O.3: Instant payout button in UI

**File:** Dashboard or `app/(app)/invoices/[id]/page.tsx`

**Plan:**

1. On each paid invoice, show a `"Get Paid Instantly"` button (Pro/Agency only).
2. Clicking it opens a confirmation modal showing:
   - `"Standard payout: $[amount] — arrives in ~2 business days"`
   - `"Instant payout: $[amount - fee] — arrives in minutes (1% fee)"`
   - Two buttons: `"Standard"` (just a dismiss) and `"Get it now"` (calls Task O.2).
3. After a successful instant payout, show a toast: `"Payout of $X requested. Funds arriving shortly."` and update the invoice to show a `"Paid Out"` badge.
4. For Free users: show the button greyed out with tooltip: `"Upgrade to Pro to use Instant Payouts."`.
5. Verify: Click "Get it now" in test mode; confirm the modal shows correct fee; confirm API call succeeds.

---

---

# PHASE P: Contractor Payroll (Micro-Teams)

**Goal:** Let users record payments made to contractors (freelancers they hire). Generate a simple payslip PDF. Track it as a business expense. No tax withholding — contractor-only for now.

**Plain English to users:** "Track what you pay your contractors. Generate a payslip so everyone has a record."

**Simplicity rules:**

- Scope: contractors only. No PAYE, no W-2, no tax withholding. That's a different product.
- A "payslip" is a one-page PDF: who paid whom, how much, for what, on what date. That's it.
- The payment is automatically recorded as a business expense.

---

## Task P.1: Prisma schema — Contractor + ContractorPayment

**File:** `prisma/schema.prisma`

```prisma
model Contractor {
  id        String              @id @default(cuid())
  userId    String
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  email     String
  role      String?             // e.g. "Designer", "Developer"
  rate      Float?              // default hourly or project rate
  rateType  String?             // "hourly" | "project" | "monthly"
  taxId     String?             // their tax ID / VAT number for records
  payments  ContractorPayment[]
  createdAt DateTime            @default(now())
}

model ContractorPayment {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  contractorId  String
  contractor    Contractor  @relation(fields: [contractorId], references: [id])
  amount        Float
  currency      String      @default("USD")
  description   String      // what was this payment for
  paymentDate   DateTime    @db.Date
  payslipUrl    String?     // generated PDF URL
  expenseId     String?     @unique  // linked Expense record (auto-created)
  createdAt     DateTime    @default(now())
}
```

Add to `User`: `contractors Contractor[]`, `contractorPayments ContractorPayment[]`

Run `npx prisma db push`.

---

## Task P.2: Contractor CRUD API

**Files:** `app/api/contractors/route.ts`, `app/api/contractors/[id]/route.ts`

**Plan:**

1. `GET /api/contractors` — list all contractors for session user.
2. `POST /api/contractors` — create contractor. Zod validation (name and email required).
3. `PUT /api/contractors/[id]` — update contractor details.
4. `DELETE /api/contractors/[id]` — delete (only if no payments recorded).
5. Verify: Create 2 contractors; list them; update one; try deleting the other.

---

## Task P.3: Record a contractor payment + generate payslip

**File:** `app/api/contractors/[id]/pay/route.ts` (new, POST, authenticated)

**Plan:**

1. Accept `{ amount, currency, description, paymentDate }`.
2. Create a `ContractorPayment` record.
3. Auto-create an `Expense` record linked to this payment: `description = "Payment to [contractor.name]"`, `amount`, `category = "Professional Services"`, `taxDeductible = true`. Set `contractorPayment.expenseId`.
4. Generate a payslip PDF using `@react-pdf/renderer` (or puppeteer). The payslip contains:
   - Your business name and address (from `BusinessProfile`)
   - Contractor name, email, tax ID
   - Payment date, amount, currency
   - Description of work
   - A note: `"This is a record of contractor payment. No tax has been withheld."`
5. Upload the PDF to Supabase Storage `payslips`. Store the URL in `contractorPayment.payslipUrl`.
6. Send an email to the contractor via Resend with the payslip PDF attached.
7. Return `{ paymentId, payslipUrl }`.
8. Verify: Record a payment; confirm the expense is created; confirm the payslip PDF is stored; confirm email is sent.

---

## Task P.4: Payroll page

**File:** `app/(app)/payroll/page.tsx` (new, Agency tier only)

**Plan:**

1. Add `"Payroll"` to sidebar nav under Zone 3 (visible only on Agency plan).
2. Page description: `"Pay your contractors and keep a record. Simple payslips, no tax headaches."`
3. Two tabs: `"Contractors"` and `"Payment History"`.
4. **Contractors tab**: list of contractors with name, role, rate. `"+ Add Contractor"` opens an inline form.
5. **Payment History tab**: all `ContractorPayment` records sorted by date. Columns: Date | Contractor | Description | Amount | Payslip. "Payslip" column shows a download icon linking to `payslipUrl`.
6. On each contractor row, a `"Record Payment"` button opens a modal with fields: Amount, Currency, Description (what were they paid for), Payment Date. Submit calls Task P.3.
7. Show a `"Total Paid to Contractors (This Year)"` summary at the top. This matches total expenses in the "Professional Services" category from Expense Tracking.
8. Verify: Add a contractor; record a payment; confirm it appears in Payment History with a downloadable payslip.

---

---

# PHASE Q: Accountant / Bookkeeper Access

**Goal:** Let the user invite their accountant to a read-only view of the app. Accountant sees invoices, expenses, P&L, and tax reports. Cannot edit anything.

**Plain English to users:** "Give your accountant a login so they can pull what they need at tax time — without calling you."

**Simplicity rules:**

- One role: `"accountant"`. Read-only everywhere. No exceptions.
- Invitation by email. No separate account registration for the accountant.
- The user can revoke access at any time in Settings.

---

## Task Q.1: Prisma schema — AccountantAccess

**File:** `prisma/schema.prisma`

```prisma
model AccountantAccess {
  id             String    @id @default(cuid())
  ownerId        String    // the user who granted access
  owner          User      @relation("OwnerAccess", fields: [ownerId], references: [id], onDelete: Cascade)
  accountantEmail String
  accountantUserId String? // set when the accountant creates/has an account
  status         String    @default("pending") // pending | active | revoked
  inviteToken    String    @unique @default(cuid())
  invitedAt      DateTime  @default(now())
  acceptedAt     DateTime?
  revokedAt      DateTime?
}
```

Add to `User`: `accountantAccess AccountantAccess[] @relation("OwnerAccess")`

Run `npx prisma db push`.

---

## Task Q.2: Invite accountant API

**Files:**

- `app/api/accountant/invite/route.ts` (new, POST, authenticated)
- `app/api/accountant/accept/route.ts` (new, POST, public — uses invite token)
- `app/api/accountant/revoke/route.ts` (new, DELETE, authenticated)

**Plan:**

1. `POST /api/accountant/invite`: accept `{ email }`. Create `AccountantAccess` record. Send an email to the accountant via Resend: `"[YourName] has invited you to view their Invoice Nudger account. Click here to accept."` with link `https://yourapp.com/accountant/accept/[inviteToken]`.
2. `POST /api/accountant/accept`: validate `inviteToken`. Set `status = "active"`, `acceptedAt = now()`. If the accountant has an existing user account with this email, set `accountantUserId`. If not, redirect to sign-up with email pre-filled.
3. `DELETE /api/accountant/revoke`: owner only. Set `status = "revoked"`, `revokedAt = now()`.
4. Verify: Invite a test email; accept the invite; confirm `status = "active"`.

---

## Task Q.3: Accountant session context

**File:** `lib/accountant-session.ts` (new utility)

**Plan:**

1. Create `getAccountantSession(req)`: checks if the logged-in user's email matches an `active` `AccountantAccess.accountantEmail`. If so, returns the `ownerId` they have access to.
2. Create a middleware helper `isViewingAsAccountant(session)` that returns `{ isAccountant: boolean, ownerId: string | null }`.
3. In every API route that reads data (`GET /api/invoices`, `GET /api/expenses`, etc.): after the standard session check, also call `getAccountantSession`. If the user is an accountant for owner X, serve owner X's data. If they try to write (POST/PUT/DELETE), return `403: "Accountant access is read-only."`.
4. Verify: Log in as the accountant email; fetch `/api/invoices`; confirm the owner's invoices are returned.

---

## Task Q.4: Accountant dashboard view

**File:** `app/(app)/accountant/[ownerId]/page.tsx` (new)

**Plan:**

1. When an accountant logs in and has active access, show a banner at the top of the app: `"You're viewing [BusinessName]'s account in read-only mode."` with a `"Return to your account"` link.
2. The accountant sees the same sidebar as the owner but all edit/create/delete buttons are hidden or disabled.
3. Add a dedicated `"Accountant View"` page at `/accountant/[ownerId]` with quick-access links to the most useful reports: P&L, Tax Estimate, Expense Report, Invoice History.
4. Add a `"Download All for Tax Year [YYYY]"` button — calls `GET /api/reports/export?year=YYYY` and downloads the full CSV.
5. In Settings, under a new `"Accountant Access"` section, show: who has access (email), their status, and a `"Revoke Access"` button.
6. Verify: Log in as accountant; confirm read-only access; confirm reports are downloadable; revoke access; confirm accountant can no longer access.

---

---

# PHASE R: Team & Agency Tier (Roles + Seats)

**Goal:** Let an agency owner add team members (e.g. a VA, a second freelancer, a bookkeeper) to the same account. Each member has a defined role with specific permissions.

**Plain English to users:** "Add your team. Control who can see what."

**Simplicity rules:**

- Three roles only: `owner`, `member` (can create/edit invoices, expenses, time), `viewer` (read-only, like accountant).
- Max 5 seats on Agency plan. Owner counts as seat 1.
- Invitation by email. Same flow as accountant invite.

---

## Task R.1: Prisma schema — TeamMember

**File:** `prisma/schema.prisma`

```prisma
model TeamMember {
  id          String   @id @default(cuid())
  ownerId     String   // the account owner
  owner       User     @relation("TeamOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  memberEmail String
  memberUserId String? // set once they accept
  role        String   @default("member") // "member" | "viewer"
  status      String   @default("pending") // pending | active | removed
  inviteToken String   @unique @default(cuid())
  invitedAt   DateTime @default(now())
  acceptedAt  DateTime?
}
```

Add to `User`: `teamMembers TeamMember[] @relation("TeamOwner")`

Run `npx prisma db push`.

---

## Task R.2: Team invitation API

**Files:** `app/api/team/invite/route.ts`, `app/api/team/accept/route.ts`, `app/api/team/[id]/remove/route.ts`

**Plan:**

1. `POST /api/team/invite`: Agency plan only. Check current seat count (`TeamMember` where `ownerId = userId` and `status != "removed"`). If >= 5, return `400: "Maximum 5 team seats reached."`. Create `TeamMember` record. Send invite email.
2. `POST /api/team/accept`: validate `inviteToken`. Set `status = "active"`. Set `memberUserId` if the email matches an existing user.
3. `DELETE /api/team/[id]/remove`: owner only. Set `status = "removed"`.
4. Verify: Invite 2 team members; accept both; confirm both appear as active.

---

## Task R.3: Team permission middleware

**File:** `lib/team-session.ts` (new utility, similar pattern to `accountant-session.ts`)

**Plan:**

1. `getTeamContext(session)`: checks if logged-in user is an active `TeamMember` for another user's account. Returns `{ ownerId, role }` or null.
2. In API routes: if the user is a `member`, allow GET + POST + PUT. Block DELETE on invoices and permanent deletes.
3. If the user is a `viewer`, allow GET only. Return `403` on all writes.
4. Verify: Log in as a `member`; create an invoice; confirm it's created under the owner's account. Log in as `viewer`; try to create; confirm 403.

---

## Task R.4: Team management page

**File:** `app/(app)/settings/team/page.tsx` (new, nested under Settings)

**Plan:**

1. Add a `"Team"` tab or section in Settings (visible only on Agency plan).
2. Show a list of current team members: Name/Email | Role | Status | Actions (Change Role, Remove).
3. `"Invite Team Member"` button opens a modal: Email, Role (dropdown: Member / Viewer), Invite.
4. Show seat usage: `"3 of 5 seats used."`.
5. For Free/Pro users: show this section greyed out with `"Upgrade to Agency to add team members."`.
6. Verify: Add a team member; change their role; remove them; confirm seat count updates.

---

---

# PHASE S: Business Credit Score & Client Health

**Goal:** Show the user a simple score (0–100) that summarises how healthy their business is financially. Also show a per-client health score so they know which clients are risky to work with.

**Plain English to users:** "A quick health check for your business — and a red flag system for slow-paying clients."

**Simplicity rules:**

- The score is a guide, not a financial instrument. Show a disclaimer.
- Never show a scary red score without an explanation of what to fix.
- Client scores are private — the client never sees their own score.

---

## Task S.1: Business health score calculation

**File:** `lib/health-score.ts` (new utility)

**Plan:**

1. `calculateBusinessHealthScore(userId)` → returns `{ score: number, breakdown: Record<string, number>, tips: string[] }`.
2. Score is 0–100, computed from weighted signals:
   - **Collection rate** (30pts): `(paid invoices / total invoices) × 30`. If 95%+ paid → 30pts. 80% → 24pts. etc.
   - **Average days to payment** (20pts): if avg < 20 days → 20pts. 20-35 days → 15pts. 35-50 → 10pts. 50+ → 5pts.
   - **Revenue consistency** (20pts): standard deviation of monthly revenue over last 6 months. Lower variance = more points.
   - **Expense ratio** (15pts): `expenses / income`. If < 30% → 15pts. 30-50% → 10pts. 50-70% → 5pts. 70%+ → 0pts.
   - **Tax reserve coverage** (15pts): `allocationProfile.taxPercent > 0` and `allocationRecord totals show tax is being set aside` → 15pts. Partial → 7pts. None → 0pts.
3. Generate 1–3 plain-English tips based on the lowest-scoring signals. E.g. if collection rate is low: `"You're collecting X% of invoices. Try sending reminders earlier or requiring a deposit upfront."`
4. Verify: Seed a user with known data; run the function; confirm score matches manual calculation.

---

## Task S.2: Client health score

**File:** `lib/client-health.ts` (new utility, builds on existing `ClientPaymentProfile`)

**Plan:**

1. `calculateClientHealthScore(userId, clientEmail)` → `{ score: number, label: string, signals: string[] }`.
2. Signals (each 0–25pts):
   - **Average days to pay**: < 15 days → 25pts; 15-30 → 20pts; 30-45 → 15pts; 45-60 → 10pts; 60+ → 5pts.
   - **Payment rate**: paid invoices / total invoices × 25.
   - **Promise kept rate**: (from AI promise detection, Phase 2) — if no data, skip and redistribute points.
   - **Dispute/cancellation rate**: invoices cancelled or unpaid after 90 days → penalise proportionally.
3. Labels: `"Excellent"` (85–100), `"Good"` (65–84), `"Average"` (45–64), `"Slow Payer"` (25–44), `"High Risk"` (0–24).
4. Verify: Test with a client who has 5 paid-on-time invoices (should be Excellent) and one with 3 late invoices (should be Slow Payer or High Risk).

---

## Task S.3: Business health score page

**File:** `app/(app)/health/page.tsx` (new)

**Plan:**

1. Add `"Business Health"` to sidebar nav (Zone 3, Pro+).
2. Page description: `"A quick check-up for your business finances."`
3. Large score display (0–100) with a colour ring: green (70+), amber (40–69), red (< 40).
4. Below the score, show the breakdown as 5 labelled progress bars (one per signal) with plain-English labels.
5. Show 1–3 tip cards below: each tip has a headline and a one-sentence action. E.g.: `"Collect faster → Enable automated reminders for day 1, 7, and 14 after due date. [Turn on]"`
6. Section below: **Client Health Table**. Columns: Client | Invoices | Avg Days to Pay | Score | Label. Sortable by score. Colour-coded label badges.
7. Show a disclaimer: `"This score is for your reference only. It is not a credit score and is not shared with any third party."`
8. Verify: Navigate to page; confirm score renders; confirm client table shows correct labels.

---

## Task S.4: "Business Health Certificate" download

**File:** `app/api/reports/health-certificate/route.ts` (new, GET, authenticated, Agency plan)

**Plan:**

1. Generate a clean one-page PDF using `@react-pdf/renderer`:
   - Your business name and logo (from `BusinessProfile`).
   - Date generated.
   - Business Health Score (large, with colour).
   - Key stats: total invoiced (year), collection rate, average payment time, on-time payment rate.
   - A note: `"Generated by Invoice Nudger. For reference purposes only."`
2. Return the PDF as a download (`Content-Disposition: attachment`).
3. Add a `"Download Health Certificate"` button on the Health page (Agency plan only). Free/Pro users see it greyed out.
4. Verify: Download the certificate; confirm it renders correctly and includes the right numbers.

---

---

# PHASE T: Cash Flow Forecast & "Pay Yourself" Reminder

**Goal:** Show the user a 90-day forward projection of their expected cash position. Separately, send a monthly reminder when there's money available to pay themselves based on their allocation profile.

**Plain English to users:** "See what's coming in over the next 3 months — and a nudge when it's time to pay yourself."

**Simplicity rules:**

- The forecast is a best-guess based on known data: recurring invoices, open invoices, and historical payment timing. It is not a guarantee.
- Show a confidence indicator. If the user has little history, the forecast has low confidence.
- The "Pay Yourself" reminder is a notification, not a transaction. The user decides when to actually move money.

---

## Task T.1: Cash flow forecast API

**File:** `app/api/reports/cashflow/route.ts` (new, GET, authenticated)

**Plan:**

1. Compute a 90-day projection. Return weekly or monthly buckets.
2. Data sources:
   - **Confirmed income**: open invoices (`status = "unpaid"`) × historical payment probability for that client (from `ClientPaymentProfile.avgDaysToPay`).
   - **Expected recurring income**: `RecurringInvoice` records where `status = "active"` and `nextRunDate` is within 90 days.
   - **Expected expenses**: `RecurringInvoice` equivalents don't exist for expenses yet — use average monthly expense from last 3 months as a flat projection.
3. For each future week/month, return: `{ period, expectedIncome, expectedExpenses, netCashFlow, cumulativeBalance, confidence }`.
4. `confidence`: `"high"` if user has 6+ months of data and > 5 clients; `"medium"` if 3–6 months; `"low"` if < 3 months.
5. Verify: Seed 3 months of invoice history + 2 recurring invoices; call the endpoint; confirm future periods show expected amounts.

---

## Task T.2: Cash flow chart

**File:** `app/(app)/accounting/page.tsx` — add a new section to the existing Accounting page.

**Plan:**

1. Add a `"Next 90 Days"` section below the existing P&L charts.
2. Use Recharts `AreaChart` or `ComposedChart`:
   - X-axis: weeks or months (next 90 days).
   - Two areas: Expected Income (green, semi-transparent) and Expected Expenses (red, semi-transparent).
   - A line: Cumulative Net Cash Flow.
3. Show the confidence level as a badge: `"Forecast confidence: Medium"` with a `ⓘ` tooltip explaining what it means.
4. Show one highlighted callout: `"Based on current data, your balance on [date 60 days out] should be approximately $X."`
5. Verify: Chart renders without errors; amounts roughly match manual calculation from the seeded data.

---

## Task T.3: "Pay Yourself" calculation

**File:** `lib/pay-yourself.ts` (new utility)

**Plan:**

1. `calculatePayYourselfAmount(userId)` → `{ available: number, recommended: number, lastPaymentDate: DateTime | null }`:
   - `available`: sum of all `AllocationRecord.ownerPayAmount` since the last time the user acknowledged a pay-yourself reminder (track this date in `BusinessProfile.lastPayYourselfDate`).
   - `recommended`: `available` (just show them everything that's accumulated).
   - `lastPaymentDate`: `BusinessProfile.lastPayYourselfDate`.
2. Verify: Create 3 allocation records with `ownerPayAmount = 400` each; call the function; confirm `available = 1200`.

---

## Task T.4: Monthly "Pay Yourself" reminder

**File:** `app/api/cron/pay-yourself-reminder/route.ts` (new, protected with cron secret)

**Plan:**

1. Schedule: first day of every month (`"0 9 1 * *"` in `vercel.json`).
2. For all Pro/Agency users:
   a. Call `calculatePayYourselfAmount(userId)`.
   b. If `available > 0`, create an in-app notification: `"💸 You have $[available] available to pay yourself this month. Based on your [X]% owner pay split."`
   c. Optionally send an email via Resend (respect user notification preferences from existing settings).
3. Do not send if `lastPayYourselfDate` is within the last 25 days (prevents double-notifying).
4. Verify: Run the cron manually; confirm notifications appear for users with accumulated owner pay.

---

## Task T.5: Pay Yourself widget on dashboard + acknowledgement

**File:** Dashboard component.

**Plan:**

1. Add a `"Pay Yourself"` card to the dashboard (Pro+ only). Shows: `"$[amount] available to pay yourself"` with a `"Done, I paid myself"` button.
2. Clicking `"Done, I paid myself"` calls `POST /api/allocation/pay-yourself-acknowledge` which sets `BusinessProfile.lastPayYourselfDate = now()`. This resets the accumulated total so the next calculation starts fresh.
3. If `available = 0`, hide the card (don't show a $0 card).
4. Verify: Acknowledge payment; confirm `lastPayYourselfDate` updates; confirm the card disappears until the next payment is received.

---

---

# UPDATED PRICING MODEL

_(Replace existing pricing section in CLAUDE.md or MEMORY.md with this)_

| Tier       | Price  | Seats   | Who it's for                                                                                         |
| ---------- | ------ | ------- | ---------------------------------------------------------------------------------------------------- |
| **Free**   | $0     | 1       | Someone just starting — 5 invoices/mo, basic reminders, 1 client portal                              |
| **Pro**    | $19/mo | 1       | Active freelancer / solopreneur — unlimited invoices + all finance features                          |
| **Agency** | $39/mo | Up to 5 | Small team / micro-agency — everything in Pro + team seats, payroll, credit score, accountant access |

**Pro unlocks:** Expenses, Tax Estimate + Report, Income Allocation, Recurring Invoices, Quotes + Contracts, Bank Import, Email Receipts, Instant Payouts, Business Health Score, Cash Flow Forecast, Pay Yourself reminders, CSV export.

**Agency unlocks:** Everything in Pro + Team Seats (up to 5), Accountant Access, Contractor Payroll, Business Health Certificate download, White-label Client Portal.

**Never gate (always free):**

- Basic expense logging (up to 20/mo)
- Tax estimate number (show it; gate the detailed breakdown + download)
- Client portal (it's a marketing surface)
- Receipt email address (hook them early)

---

---

# PROGRESSIVE DISCLOSURE — FINAL SIDEBAR ORDER

Show items progressively based on user engagement. Never show everything to a new user.

**New user (< 5 invoices, Free plan):**

```
📊 Dashboard
📄 Invoices
💰 Payments
👥 Clients
⚙️ Settings
```

**Engaged user (5+ invoices or 30+ days active):**

```
+ 📋 Quotes
+ 📝 Contracts
+ 🔁 Recurring
+ 💸 Expenses
+ 🧾 Tax
```

**Pro user:**

```
+ ⏱ Time
+ 💵 My Money
+ 🏦 Bank
+ 📈 Accounting
+ 💡 Insights
+ 📧 (receipt email, in Settings)
```

**Agency user:**

```
+ 🫂 Payroll
+ 💪 Business Health
+ 👔 Team (in Settings)
+ 🔑 Accountant Access (in Settings)
```

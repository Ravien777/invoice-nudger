# Maroni Product Roadmap — Expansion Phases

## Overview

This document defines all planned features beyond the current platform, organized by impact tier. Each section includes purpose, data model changes, API surface, implementation order, and monetization strategy.

---

## Tier 1 — Game-Changers (10x Revenue & Retention)

### 1.1 Auto-Charge Clients (Stripe Connect + Saved Payment Methods)

**Purpose:** Transform Maroni from an invoice reminder tool into an automated collection platform. Users save a client's payment method once; Maroni charges on the due date (and retries on failure).

**Data model additions:**

```prisma
model ClientPaymentMethod {
  id              String   @id @default(cuid())
  userId          String
  plazaosClientId String?  // optional link to PlazaOS client
  clientEmail     String
  clientName      String?
  stripePaymentMethodId String
  stripeSetupIntentId   String?
  stripeCustomerId      String?
  isDefault       Boolean  @default(false)
  status          String   @default("active") // active | expired | removed
  lastChargedAt   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, clientEmail])
}
```

**API endpoints:**

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/clients/setup-payment` | Create SetupIntent, return client secret for Stripe Elements |
| `POST` | `/api/clients/payment-methods` | Save a confirmed PaymentMethod ID |
| `GET` | `/api/clients/payment-methods` | List saved methods for a client |
| `DELETE` | `/api/clients/payment-methods/[id]` | Remove a saved method |
| `POST` | `/api/invoices/[id]/auto-charge` | Manually trigger a charge against saved method |
| `POST` | `/api/invoices/[id]/auto-charge/enable` | Enable auto-charge for this invoice |

**Behavior:**

- Invoice created with `autoCharge: true` → on `dueDate`, create and confirm PaymentIntent
- PaymentIntent succeeds → mark invoice paid, fire `invoice.paid` webhook, create reconciliation record
- PaymentIntent fails → log failure, send escalation email, retry after 3 days (up to 3 retries)
- Each failed retry escalates: email → SMS → final notice
- After 3 failures → auto-charge disabled, manual follow-up required

**User-facing webhook events (subscribable via API platform):**

| Event | When | Payload |
|---|---|---|
| `charge.completed` | Auto-charge succeeded | `{ invoice_id, amount, method_id }` |
| `charge.failed` | Auto-charge failed | `{ invoice_id, amount, failure_reason, retry_count }` |
| `payment_method.expiring` | Card expiring soon | `{ method_id, client_email }` |

**Monetization:**

- **Free:** Manual payment links only
- **Pro:** Auto-charge (up to 50 charges/mo)
- **Agency:** Unlimited auto-charge
- Per-transaction fee: $0.30 + 0.5% (above Stripe fees)

**Implementation order:**

1. Add `ClientPaymentMethod` model to Prisma
2. Build setup-intent endpoint (returns Stripe client_secret)
3. Build save-payment-method endpoint
4. Build Stripe webhook handler for `setup_intent.succeeded`
5. Build charge-on-due-date logic (check every hour via cron or edge function)
6. Build PaymentIntent webhook handling (success/failure)
7. Build retry escalation logic (3 attempts, escalating channels)
8. Build UI: payment method management in client detail page
9. Build invoice detail: auto-charge toggle, charge history
10. Add usage metering (count charges per month)

---

### 1.2 Payment Plans / Installments

**Purpose:** Allow users to split large invoices into multiple payments (e.g. 4 monthly installments). Clients see installment options on the payment page and choose what works for them.

**Data model additions:**

```prisma
model PaymentPlan {
  id            String   @id @default(cuid())
  invoiceId     String   @unique
  totalAmount   Float
  currency      String   @default("USD")
  installments  Int      @default(1)
  intervalDays  Int      @default(30)
  status        String   @default("active") // active | completed | cancelled
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([invoiceId])
}

model PaymentPlanInstallment {
  id              String   @id @default(cuid())
  planId          String
  plan            PaymentPlan @relation(fields: [planId], references: [id])
  amount          Float
  dueDate         DateTime
  status          String   @default("pending") // pending | paid | failed | skipped
  paymentIntentId String?
  paidAt          DateTime?
  createdAt       DateTime @default(now())

  @@index([planId])
}
```

**API endpoints:**

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/invoices/[id]/payment-plan` | Create a payment plan for an invoice |
| `GET` | `/api/invoices/[id]/payment-plan` | Get existing payment plan |
| `PUT` | `/api/invoices/[id]/payment-plan` | Modify plan (before first payment) |
| `DELETE` | `/api/invoices/[id]/payment-plan` | Cancel plan |
| `GET` | `/api/payment-plans` | List all payment plans |

**Behavior:**

- User creates plan: choose number of installments (2, 3, 4, 6, 12) and interval (weekly, biweekly, monthly)
- System calculates installment amounts (total / count, last absorbs remainder)
- Client sees installment options on Stripe Payment Link page
- Each installment is a separate PaymentIntent charged on its due date
- If any installment fails → pause remaining installments, notify user
- Client can still pay remaining balance early in full

**Monetization:**

- **Pro:** Up to 3 installments per invoice
- **Agency:** Unlimited installments
- Per-installment fee: $0.25

**Implementation order:**

1. Add `PaymentPlan` + `PaymentPlanInstallment` models
2. Build plan creation API (validate amount, dates, count)
3. Integrate with auto-charge system (charge each installment on due date)
4. Build plan display on invoice detail page
5. Build installment options on public payment page
6. Build early payoff endpoint
7. Handle installment failure → pause + notify

---

### 1.3 User-Facing API + Webhook Platform

**Purpose:** Turn Maroni into a platform. Users generate their own API keys, configure webhook endpoints, and build custom integrations (Zapier, Make, or direct code).

**Data model additions:**

```prisma
model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  name      String
  keyHash   String   @unique
  lastChars String   // last 4 chars for display
  scopes    Json?    // ["invoices:read", "invoices:write", "clients:read", etc.]
  lastUsedAt DateTime?
  expiresAt DateTime?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([userId])
}

model WebhookEndpoint {
  id        String   @id @default(cuid())
  userId    String
  url       String
  secret    String
  events    Json     // ["invoice.created", "invoice.paid", "invoice.overdue", ...]
  isActive  Boolean  @default(true)
  lastSentAt DateTime?
  lastStatus Int?     // last HTTP status code
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  endpointId  String
  event       String
  payload     Json
  status      Int?     // HTTP status
  responseBody String?
  durationMs  Int?
  success     Boolean
  attemptedAt DateTime @default(now())
  nextRetryAt DateTime?

  @@index([endpointId, attemptedAt])
}
```

**API endpoints:**

| Method | Route | Purpose |
|---|---|---|
| `GET/POST` | `/api/settings/api-keys` | List / create API keys |
| `DELETE` | `/api/settings/api-keys/[id]` | Revoke an API key |
| `GET/POST` | `/api/settings/webhooks` | List / create webhook endpoints |
| `PUT/DELETE` | `/api/settings/webhooks/[id]` | Update / delete endpoint |
| `GET` | `/api/settings/webhooks/[id]/deliveries` | View delivery log |
| `POST` | `/api/settings/webhooks/[id]/test` | Send test event |

**External API endpoints (authenticated via X-API-Key):**

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/v1/invoices` | List user's invoices (with filters) |
| `GET` | `/api/v1/invoices/[id]` | Get single invoice |
| `GET` | `/api/v1/clients` | List user's clients |
| `GET` | `/api/v1/expenses` | List user's expenses |
| `GET` | `/api/v1/summary` | Dashboard-style aggregate |

**User-facing events (subscribable):**

| Event | Payload |
|---|---|
| `invoice.created` | `{ invoice_id, client_email, amount, status }` |
| `invoice.paid` | `{ invoice_id, client_email, amount, paid_at }` |
| `invoice.overdue` | `{ invoice_id, client_email, amount, days_overdue }` |
| `invoice.reminder_sent` | `{ invoice_id, step_name, channel }` |
| `client.promise_detected` | `{ invoice_id, promised_date, confidence }` |
| `payment.received` | `{ invoice_id, amount, source }` |
| `expense.created` | `{ expense_id, amount, category }` |

**Monetization:**

- **Free:** No API access
- **Pro:** 3 API keys, 2 webhook endpoints, 1,000 webhook deliveries/mo
- **Agency:** 10 API keys, 10 webhook endpoints, 50,000 deliveries/mo
- Rate limiting: Pro 100 req/min, Agency 1,000 req/min

**Implementation order:**

1. Add `ApiKey`, `WebhookEndpoint`, `WebhookDelivery` models
2. Build API key generation + hashing
3. Build API key auth middleware (`validateUserApiKey()`)
4. Build `/api/v1/*` read endpoints (invoices, clients, expenses, summary)
5. Build webhook endpoint CRUD UI in Settings
6. Build webhook dispatcher (on event: lookup endpoints, POST with HMAC, log delivery)
7. Build delivery log UI
8. Build retry logic (3 attempts with exponential backoff)
9. Add webhook events to existing triggers (invoice create, paid, overdue, reminder sent)
10. Add rate limiting per API key

---

### 1.4 Multi-Company / Multi-Entity

**Purpose:** Allow a single user to manage multiple businesses (LLCs, DBAs, brands) under one account. Switch between entities via sidebar dropdown.

**Data model additions:**

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  ownerId     String
  plan        String   @default("free")
  stripeCustomerId String?
  stripeSubscriptionId String?
  stripePriceId String?
  subscriptionStatus String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
}

model OrganizationMember {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  userId         String
  role           String   @default("owner") // owner | admin | member | viewer
  createdAt      DateTime @default(now())

  @@unique([organizationId, userId])
}
```

**Schema migration:**

Add optional `organizationId` to all existing data models (Invoice, Expense, ClientPaymentProfile, Quote, Contract, RecurringInvoice, TimeEntry, BankConnection, etc.):

```prisma
  organizationId String?
  @@index([organizationId])
```

**Behavior:**

- Existing users get auto-migrated: a default Organization created + all their data tagged
- New users get an Organization on signup
- Sidebar shows entity switcher at the top
- All queries scope to `organizationId` instead of `userId`
- Team members are scoped to Organization (not User)

**Monetization:**

- **Free:** 1 entity
- **Pro:** 2 entities
- **Agency:** 5 entities
- Additional entities: $5/mo each

**Implementation order:**

1. Add `Organization` + `OrganizationMember` models
2. Create migration script to auto-create org for existing users
3. Add `organizationId` to all data models
4. Build entity switcher UI in sidebar
5. Refactor all queries to scope by `organizationId`
6. Build org settings page (name, members, billing)
7. Build org creation flow
8. Build org-level subscription management

---

## Tier 2 — Significant Value-Add

### 2.1 Mobile Push Notifications

**Purpose:** Push notifications via Web Push API for key events (invoice paid, overdue, client action). Increases engagement and reduces time-to-action.

**Data model additions:**

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())

  @@index([userId])
}
```

**API endpoints:**

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/push/subscribe` | Save a new push subscription |
| `POST` | `/api/push/unsubscribe` | Remove a subscription |
| `POST` | `/api/push/test` | Send test notification |

**Implementation order:**

1. Generate VAPID keys, add to env vars
2. Add `PushSubscription` model
3. Build subscribe/unsubscribe endpoints
4. Install `web-push` npm package
5. Add `beforeinstallprompt` listener in PWA registration
6. Fire push notifications on invoice.paid, invoice.overdue, payment.received
7. Add push notification settings UI (opt-in/out per event type)

**Monetization:** Included in all plans (drives engagement, reduces churn)

---

### 2.2 A/R Aging Report

**Purpose:** Standard accounts receivable aging report: buckets for 0-30, 31-60, 61-90, 90+ days overdue.

**API endpoint:**

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/reports/aging` | A/R aging report with bucket amounts + counts |

**Response format:**

```json
{
  "reportDate": "2026-06-11",
  "totalOutstanding": 25000.0,
  "buckets": {
    "current": { "amount": 5000.0, "count": 5 },
    "1-30": { "amount": 8000.0, "count": 4 },
    "31-60": { "amount": 6000.0, "count": 3 },
    "61-90": { "amount": 4000.0, "count": 2 },
    "90+": { "amount": 2000.0, "count": 1 }
  },
  "byClient": [
    { "clientEmail": "...", "clientName": "...", "total": 3000.0, "bucket": "31-60" }
  ]
}
```

**Implementation order:**

1. Build query logic: group unpaid invoices by days overdue buckets
2. Create `/api/reports/aging` endpoint
3. Build aging report UI page under Reports or Clients
4. Add CSV export

**Monetization:** Gated under Pro+

---

### 2.3 AI Expense Categorization

**Purpose:** Auto-categorize expenses using OpenAI when created (or when receipt is uploaded). Saves manual category selection.

**Implementation:**

```typescript
// lib/openai.ts — new function
async function categorizeExpense(description: string, vendor: string, categories: string[]): Promise<string>
```

- Prompt: "Given this expense description and vendor, select the most appropriate category from this list. Return only the category name."
- Called in `POST /api/expenses` when no `categoryId` is provided
- Also called when a receipt is parsed via inbound email

**Implementation order:**

1. Add `categorizeExpense()` to `lib/openai.ts`
2. Hook into expense creation (POST /api/expenses) — run AI categorization if no category provided
3. Hook into receipt parsing — categorize parsed expenses
4. Add "AI-suggested" badge on auto-categorized expenses
5. Allow user to override category

**Monetization:** Counts toward AI usage meter (existing `AIReminderUsage` model can be repurposed or extended)

---

### 2.4 Client Portal: File Upload + Messaging

**Purpose:** Enhance client portal with document upload (receipts, POs, signed documents) and simple messaging (notes between business and client).

**Data model additions:**

```prisma
model PortalFile {
  id              String   @id @default(cuid())
  clientPortalTokenId String
  clientEmail     String
  userId          String
  fileName        String
  fileUrl         String   // Vercel Blob URL
  fileSize        Int?
  mimeType        String?
  uploadedBy      String   // "client" | "business"
  createdAt       DateTime @default(now())

  @@index([clientPortalTokenId])
  @@index([clientEmail])
}
```

**API endpoints:**

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/portal/upload` | Upload file (client-side) |
| `GET` | `/api/portal/files` | List files for a token |
| `DELETE` | `/api/portal/files/[id]` | Delete file |

**Portal UI additions:**

- New "Files" tab showing uploaded documents
- Upload button (client + business sides)
- File preview (images, PDFs inline)
- Simple messaging: text area + send button, displayed as threaded messages

**Implementation order:**

1. Add `PortalFile` model
2. Build upload endpoint (uses existing Vercel Blob)
3. Add files tab to client portal UI
4. Add messaging (minimal: text + timestamp per client)
5. Add notification to business when client uploads file or sends message

**Monetization:** Pro+ (existing portal gating)

---

### 2.5 Balance Sheet Report

**Purpose:** Standard balance sheet report: assets = liabilities + equity. Useful for loan applications and financial planning.

**API endpoint:**

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/reports/balance-sheet` | Balance sheet at a point in time |

**Logic:**

- Assets: Total outstanding invoices + bank balance (manual entry or Plaid)
- Liabilities: Total unpaid expenses + credit card balances (future)
- Equity: Assets - Liabilities (or owner's equity from allocation profile)

**Implementation order:**

1. Build balance sheet computation logic (assets from invoices, liabilities from expenses)
2. Create `/api/reports/balance-sheet` endpoint
3. Build UI page under Reports
4. Add PDF export

**Monetization:** Agency tier

---

## Tier 3 — Nice-to-Haves

### 3.1 Enhanced Multi-Step Onboarding

**Purpose:** Replace single-modal onboarding with a guided wizard (3-5 steps) that collects business profile, connects Stripe, and creates the first invoice.

**Steps:**

1. Welcome + business name / logo
2. Connect Stripe account (or skip, use manual)
3. Set default reminder schedule
4. Create first invoice (or import CSV)
5. Done → dashboard with contextual tips

**Implementation order:**

1. Build multi-step onboarding component with progress indicator
2. Step 1: Business profile form (name, logo upload, currency)
3. Step 2: Stripe Connect (or skip)
4. Step 3: Reminder schedule selector
5. Step 4: Quick invoice creation form
6. Step 5: Completion animation + "Tip: try importing a CSV"

---

### 3.2 AI Cash Flow Insights

**Purpose:** In addition to the forecast chart, show a generative AI narrative: "Based on current trends, you may have a cash shortfall of ~$1,200 around June 25. Consider following up on 3 overdue invoices."

**Implementation:**

- `generateCashFlowInsight()` in `lib/openai.ts`
- Takes forecast data + current state → returns 2-3 sentence analysis
- Displayed above the forecast chart as a callout box
- Regenerated on page load (cached via `react.cache()`)

---

### 3.3 Vendor / Bill Pay Management

**Purpose:** Track bills from vendors/suppliers with due dates and auto-pay. Currently Maroni only tracks expenses (past payments), not upcoming bills.

**Data model:**

```prisma
model Bill {
  id          String   @id @default(cuid())
  userId      String
  vendorName  String
  amount      Float
  currency    String   @default("USD")
  dueDate     DateTime
  category    String?
  notes       String?
  status      String   @default("unpaid") // unpaid | paid | cancelled
  paidAt      DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, status])
  @@index([userId, dueDate])
}
```

---

### 3.4 Client Credit Scoring

**Purpose:** Integrate with business credit bureaus (Dun & Bradstreet, Experian) to check client creditworthiness before sending large invoices.

**Implementation:**

- New client detail section: "Credit Check"
- Button to run credit check (costs API credit)
- Display score + risk level
- Store in `ClientPaymentProfile` as `externalCreditScore`

---

## Implementation Order Summary

| Priority | Feature | Est. Effort | Revenue Impact |
|---|---|---|---|
| 1 | Auto-charge clients | 3-4 weeks | High |
| 2 | Payment plans / installments | 2-3 weeks | High |
| 3 | User-facing API + webhooks | 3-4 weeks | Medium |
| 4 | Multi-company / multi-entity | 4-6 weeks | High |
| 5 | A/R aging report | 1 week | Low |
| 6 | AI expense categorization | 1 week | Low |
| 7 | Client portal enhancements | 2 weeks | Medium |
| 8 | Mobile push notifications | 1 week | Low |
| 9 | Balance sheet report | 1 week | Low |
| 10 | Enhanced onboarding | 1-2 weeks | Medium |
| 11 | AI cash flow insights | 1 week | Low |
| 12 | Vendor / bill pay | 2-3 weeks | Medium |
| 13 | Client credit scoring | 1-2 weeks | Low |

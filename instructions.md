# Invoice Nudger — AI Coding Agent Instructions

## Overview

This document is an implementation guide for AI coding agents working on Invoice Nudger. It is organized into clear, task-driven features and release phases.

## Already done

1. Phase 1 — Immediate monetisation & marketing
   - Feature 1: Stripe payment links
   - Feature 2: Stripe webhook auto-pay
   - Feature 3: Subscription tiers with usage limits
   - Feature 4: Public email templates page
2. Phase 2 — Advanced platform expansion
   - Feature 5: Accounting integrations
   - Feature 6: AI-generated reminder copy
   - Feature 7: White-labeled client portal
   - Feature 8: Automated reconciliation
   - Feature 9: Promise detection workflow
   - Feature 10: SMS & WhatsApp nudges
   - Feature 11: Late fees / interest calculator

## Agent rules

- Work inside the existing Next.js App Router codebase.
- Keep changes focused on the task and avoid unrelated refactors.
- Use Prisma migrations for database changes.
- Prefer explicit, incremental commits or patches.
- When implementing a feature, include the minimum UI flows needed to verify it.

---

# Invoice Nudger — Strategy 2 Implementation Plan
## Insights-to-Expert Flywheel

**Goal:** Use the data you’re already collecting (invoices, payments, reminders, client replies, late fees) to provide metrics, scores, forecasts, and benchmarks that no other simple tool offers. This creates deep user lock-in and justifies premium pricing.

---

## 🔧 Prerequisites (Already Done)
- Phase 1 & 2 features fully operational.
- Data available:
  - `Invoice` records with statuses, due dates, paid dates, amounts, client emails, late fees.
  - `ReminderLog` with sent times, step names.
  - `User` settings (plan, industry category perhaps – if not, add a simple field).
  - Payment events via Stripe webhook (or manual).
  - Accounting integration data (Xero/QuickBooks) if connected.

---

## 🧱 Feature 0: Analytics Data Layer (Foundation)

**Goal:** Create aggregated tables and a background job to power all insights without running heavy queries on the live transactional tables every time a user loads their dashboard.

**Breakdown:**

### 1. Database Models (Prisma)

Add these to `schema.prisma`:

```prisma
model InvoiceDailySummary {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      DateTime @db.Date // the calendar date
  // invoice counts
  totalInvoices     Int @default(0)
  paidInvoices      Int @default(0)
  overdueInvoices   Int @default(0)
  // amounts
  totalAmount       Float @default(0)
  collectedAmount   Float @default(0)
  overdueAmount     Float @default(0)
  // payment timing
  avgDaysToPay      Float?
  // unique client emails that had invoices due this day (for client metrics)
  activeClientEmails Json? // array of strings
  createdAt DateTime @default(now())

  @@unique([userId, date])
}

model ClientPaymentProfile {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  clientEmail     String
  totalInvoices   Int      @default(0)
  paidInvoices    Int      @default(0)
  onTimePayments  Int      @default(0) // paid within 0 days after due? Define.
  totalAmount     Float    @default(0)
  avgDaysLate     Float?
  lastPaymentDate DateTime?
  riskScore       Float?   // 0-1, higher = riskier
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())

  @@unique([userId, clientEmail])
}

model IndustryBenchmark {
  id             String   @id @default(cuid())
  industry       String   // e.g., "freelance_design", "web_dev", "consulting", "all"
  metric         String   // e.g., "avg_days_to_pay", "collection_rate", "late_payment_percentage"
  value          Float
  sampleSize     Int
  computedAt     DateTime @default(now())
  @@unique([industry, metric, computedAt])
}
```

Run `npx prisma db push` to apply.

### 2. Data Aggregation Job (Background)

Create a daily cron endpoint `/api/cron/compute-analytics` (protected with secret) that does the following:

- **InvoiceDailySummary**: For each user, for the past day (yesterday), count invoices created, paid, overdue, and aggregate amounts. Compute `avgDaysToPay` for invoices paid that day (difference between `paidAt` and `dueDate`).
- **ClientPaymentProfile**: For each user, for each distinct `clientEmail` across all their invoices, recompute the profile: total invoices, paid count, on-time count (define “on time” as paid within e.g., 3 days after due?), average days late (for late payments only), last payment date.
- **Risk Score**: Compute a simple formula: riskScore = (1 - onTimeRatio) * 0.7 + (avgDaysLate / 30) * 0.3 (capped at 1). Adjust later.
- **IndustryBenchmark** (if enough users): Aggregate anonymized data across all users (opt-in) to compute industry-level metrics. Initially, you can hard-code some fake benchmarks until you have enough data, but design the table to store real ones.

Use `date-fns` for date manipulation. Avoid heavy queries on the main tables by using the aggregated summaries once built.

### 3. On-Demand Refresh
Create an API endpoint `/api/analytics/refresh` (POST, authenticated) that a user can trigger to update their own analytics immediately (for testing or after major data changes). It runs the same logic but scoped to that user.

### 4. Seed Initial Data
Write a script (one-off) that processes all historical data to populate `InvoiceDailySummary` and `ClientPaymentProfile` for all users. This ensures the insights appear immediately on launch.

### 5. Dashboard Query Efficiency
All future insight pages will read from these aggregated tables (or from client profiles directly) for speed. Raw invoice scans only happen for real-time counts (today's unpaid count) which can be cached.

---

## 📊 Feature 1: Client Payment Behavior Analytics (Client Risk Profiles)

**Goal:** Give users a complete picture of each client’s payment habits so they can make informed decisions about payment terms, deposits, or whether to work with them again.

**Breakdown:**

### 1. UI Page
- New route: `/app/clients` (protected).
- Table showing: Client Email, Total Invoices, Paid on Time %, Average Days Late, Risk Level (Low/Medium/High), Last Payment Date.
- Click a row to see detailed profile: `/clients/[encodedEmail]`.

### 2. Detail View
- All invoices for that client (paginated) with status and dates.
- Charts:
  - Payment history timeline (due date vs paid date).
  - Trend of payment delay over time (are they getting worse?).
- Risk score explanation (tooltip showing how it's calculated).
- Actionable insights: “This client typically pays 12 days late. Consider sending reminders 7 days before due.”

### 3. Data Source
- Use `ClientPaymentProfile` table for the list and score.
- For detail, query `Invoice` directly filtered by `clientEmail` and `userId`.

### 4. Real-Time Score Update
- Whenever an invoice is marked as paid, trigger a lightweight recalculation for that client (via a server function) to update the profile immediately, so the score is always fresh.

### 5. Sorting & Filtering
- Allow sorting by risk score, total amount, last payment date.
- Search by client email.

### 6. Integration
- Add a small client risk badge next to the client name on the invoice list and invoice detail page, with a link to the client profile.

---

## 🎯 Feature 2: Payment Probability Score for Open Invoices

**Goal:** For every unpaid invoice, show the user a predicted likelihood (percentage) that it will be paid on time (or paid at all). This helps prioritize follow-ups and manage cash flow expectations.

**Breakdown:**

### 1. Scoring Model
We’ll use a heuristic model initially (no AI required for MVP) based on:
- Client historical behavior (from `ClientPaymentProfile`):
  - `onTimeRatio = onTimePayments / paidInvoices` (or total if paid=0 then 0.5 default)
  - `avgDaysLate` (capped)
- Invoice properties:
  - Amount (higher amounts may be riskier? Could be neutral, but include as factor)
  - Days until due (or days past due if overdue)
  - Presence of a payment link? (maybe not)
- Weight formula: `probability = 1 - ( (1 - onTimeRatio) * 0.6 + (min(avgDaysLate, 30) / 30) * 0.4 )`. Clamp between 0 and 1.
- If no historical data for this client (new client), use a default of 0.7 (70%) with a “low confidence” label.

### 2. Store Score
Add to Invoice model: `paymentProbability Float?`. Compute it whenever an invoice is created or updated, or when the client profile changes (trigger re-calculation for all open invoices of that client).

### 3. Display
- On invoice list/detail, show a probability badge (color-coded: green >80%, yellow 50-80%, red <50%).
- Tooltip: “Based on this client’s history of paying X% on time and averaging Y days late.”

### 4. API
- Endpoint `/api/invoices/[id]/probability` returns the current score and the breakdown (factors) for transparency.

### 5. Daily Refresh
- In the nightly analytics cron, re-calculate probabilities for all open invoices to pick up new client profile changes.

### 6. Premium Feature
- Gate this under Pro/Agency plans, as it uses historical data and adds significant value.

---

## 📈 Feature 3: Industry Benchmarks

**Goal:** Show users how their collection performance compares to others in their industry, providing context and motivating improvement.

**Breakdown:**

### 1. Industry Selection
- Add a field `industry` to the `User` model (dropdown during onboarding, e.g., “Freelance Design”, “Software Development”, “Consulting”, “Marketing Agency”, “Other”). Update DB and profile settings page.
- Also allow “All Industries” benchmarks.

### 2. Anonymized Data Collection
- In the daily analytics job, after updating user-level summaries, aggregate anonymized data per industry into `IndustryBenchmark`.
- Metrics to compute:
  - `avg_days_to_pay` (average of `avgDaysToPay` from paid invoices across users, weighted by number of invoices or not).
  - `collection_rate` (percentage of invoices that eventually get paid, based on invoices that are >90 days old?).
  - `late_payment_percentage` (percentage of invoices paid after due date).
  - `average_invoice_amount`.
- Use a minimum sample size (e.g., 10 users) to show a benchmark; otherwise show “Not enough data”.

### 3. Dashboard Widget
- On the main dashboard, show a card: “Your Avg Days to Pay: 12 days | Industry Avg: 8 days (Top 40%)”. Use a simple bar chart or gauge.
- Include “You’re in the top X% of peers” if possible.

### 4. Benchmark Trends
- Allow users to view their benchmark over time (line chart) vs industry.

### 5. Privacy
- Make benchmarks opt-out (default included). Mention in privacy policy that we use aggregated, anonymized data to provide benchmarking. Provide a toggle in settings to exclude your data from benchmarks (then the user still sees benchmarks but their data doesn’t contribute).

### 6. Upsell
- Offer a “detailed benchmark report” as a PDF for Pro users, comparing against multiple industries or deeper metrics.

---

## 💰 Feature 4: Cash Flow Forecasting

**Goal:** Project future cash inflows based on open invoices, historical payment timing, and estimated probabilities, giving users a clear picture of what to expect in their bank account over the next 30/60/90 days.

**Breakdown:**

### 1. Data Needed
- All open (unpaid) invoices with due dates and payment probability scores.
- Historical daily aggregated collection amounts (from `InvoiceDailySummary.collectedAmount`) to seed a simple moving average of daily income from non-invoice sources if applicable, but focus on invoice-based forecasting.

### 2. Simple Forecasting Model
- For each open invoice, predict payment date: if probability > 0.5, assume payment will occur at `dueDate + (expected delay)`, where expected delay = weighted average of the client’s avgDaysLate (if available) or a default of 0 days.
- Use probability to discount the amount: expected value = amount * probability.
- Sum these daily expected values over the next 30/60/90 days to produce a cumulative forecast line.

### 3. Chart Implementation
- Use a charting library (Recharts, Chart.js) to show:
  - X-axis: date
  - Y-axis: cumulative expected cash (or daily expected inflow)
  - Overlay a “worst case” line (only invoices with probability > 0.7) and a “best case” line (all open invoices assumed paid on time).
- Also show a “today” line showing current cash position if you integrate a cash balance (maybe later).

### 4. Update Frequency
- Recompute forecast on each dashboard load or on a nightly cron and cache it (store forecast data in a JSON field on user or a separate table). For MVP, calculate live on request with caching (e.g., 1-hour stale-while-revalidate).

### 5. UI
- New tab or card on dashboard: “Cash Flow Forecast”.
- Filters: Next 30/60/90 days.
- Tooltip showing top upcoming invoices.

### 6. Accuracy Feedback
- Display a confidence note: “Based on historical client payment patterns and current open invoices. Actual results may vary.”

---

## 🧠 Feature 5: Collection Efficiency Insights

**Goal:** Show users the direct impact of Invoice Nudger reminders and help them optimize their reminder strategy.

**Breakdown:**

### 1. Metrics to Track
- **Reminder Conversion Rate**: After a reminder is sent, percentage of invoices that are paid within X days (e.g., 3 days).
- **Time Saved**: Average days between when a reminder was sent and when payment occurred, compared to if no reminder had been sent (estimated from historical ‘no reminder’ baseline, perhaps from users who didn’t use reminders previously, but simpler: show the time after reminder until payment).
- **Most Effective Template/Channel**: Compare open/pay rates for different email templates or SMS vs email.

### 2. Data Requirements
- Use `ReminderLog` joined with `Invoice` to calculate payment events after reminders.
- For each invoice, identify the last reminder sent before payment, and the time gap.
- Aggregate per user.

### 3. Dashboard Widget
- “Since you started using Invoice Nudger, you’ve collected payments 9 days faster on average.”
- “Your ‘Final Notice’ email template has a 45% payment rate within 24 hours.”
- “3 invoices were paid immediately after SMS reminders.”

### 4. A/B Testing Insights (Future)
- If you later implement AI-generated reminders, track performance of AI vs. static templates and show the uplift.

### 5. Export
- Pro/Agency users can download an “Efficiency Report” PDF summarizing these metrics for their accountant or to show ROI of the tool.

### 6. Privacy & Accuracy
- Only aggregate data for invoices where reminders were actually sent. Avoid comparing to non-reminder invoices because those might be self-selected (early payers). Focus on before/after using the tool.

---

## 🚀 Feature 6: Predictive Alerts & Recommendations

**Goal:** Proactively notify users about high-risk situations and suggest actions to improve collections.

**Breakdown:**

### 1. Alert Rules
- **High-Risk Invoice**: An invoice with payment probability < 30% and due within 7 days or already overdue.
- **Client Deterioration**: A client’s on-time payment rate drops by more than 20% compared to previous period.
- **Cash Flow Gap**: Forecasted cash inflow for the next 15 days is below a user-defined threshold (or 50% lower than previous month).

### 2. In-App Notifications
- Create a simple notification system (bell icon) using a `Notification` model:
  ```
  model Notification {
    id        String   @id @default(cuid())
    userId    String
    user      User     @relation(...)
    type      String   // "high_risk_invoice", "client_deterioration", "cash_flow_gap"
    title     String
    message   String
    read      Boolean  @default(false)
    metadata  Json?    // reference invoiceId, etc.
    createdAt DateTime @default(now())
  }
  ```
- Add a notification bell in the top nav with a badge count.

### 3. Generation Job
- In the nightly analytics cron (or a separate hourly job for real-time), evaluate rules and create notifications.

### 4. Email Digests
- Optional weekly email digest: “Your collection health summary” with top insights and alerts.

### 5. User Preferences
- Allow users to customize which alerts they receive (settings page).

---

## 📅 Implementation Order & Dependencies

1. **Feature 0 (Analytics Data Layer)** — Everything else depends on this.
2. **Feature 1 (Client Risk Profiles)** — Builds on 0, immediately useful.
3. **Feature 2 (Payment Probability)** — Builds on client profiles, adds value to invoice view.
4. **Feature 3 (Industry Benchmarks)** — Needs aggregated data from 0, but can be built in parallel.
5. **Feature 4 (Cash Flow Forecasting)** — Uses probability scores from Feature 2 + aggregated data.
6. **Feature 5 (Collection Efficiency)** — After reminders data is rich, but can be built anytime after 0.
7. **Feature 6 (Predictive Alerts)** — Combine all insights; adds proactive value.

---

## ✅ Testing Each Feature
After each feature is built, test by:
- Seeding your own account with diverse invoices, clients, and payment histories.
- Running the aggregation cron manually.
- Checking dashboards and charts display data correctly.
- Trying edge cases (no data, one client, zero payments).

# Maroni

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-brightgreen)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)]()
[![Prisma](https://img.shields.io/badge/Prisma-4-2D3748?logo=prisma)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)]()

> From invoices to payout, steady.

Maroni is an all-in-one finance platform for freelancers, indie hackers, and small businesses. It automatically sends escalating payment reminders when invoices are unpaid, and now covers your entire financial workflow — from quotes and time tracking to expense management, tax estimation, and accounting.

---

## Why Maroni?

Most finance tools were built for accountants. Maroni was built for **you** — the solo founder, freelancer, or micro-agency that just wants to get paid without the overhead.

| You need to... | Wave | FreshBooks | HoneyBook | QuickBooks | **Maroni** |
|---|---|---|---|---|---|
| Send a quick invoice | ✅ | ✅ | ✅ | ✅ | ✅ **(simpler)** |
| Auto-remind late payers | ❌ | ✅ | ❌ | ❌ | ✅ **(built-in)** |
| Track time and bill it | ❌ | ✅ | ✅ | ✅ | ✅ **(planned)** |
| Snap a receipt, log expense | ❌ | ✅ | ❌ | ✅ | ✅ **(planned)** |
| Estimate taxes automatically | ❌ | ❌ | ❌ | ❌ | ✅ **(planned)** |
| Connect your bank feed | ✅ | ✅ | ❌ | ✅ | ✅ **(planned)** |
| Get a client portal | ❌ | ❌ | ✅ | ❌ | ✅ **(white-labeled)** |
| Send quotes → convert to invoice | ❌ | ✅ | ✅ | ✅ | ✅ **(planned)** |
| Pay per month | ~$20+ | ~$17+ | ~$39+ | ~$30+ | **Free tier, Pro $12, Agency $29** |
| Set up in 5 minutes | ❌ | ❌ | ❌ | ❌ | **✅ (magic link, no CC)** |

**The short version:** Wave is free but has no reminders or portal. HoneyBook is built for event pros and costs more. FreshBooks and QuickBooks are powerful but expensive and complex. Maroni is **simple, affordable, and does the chasing for you**.

---

## Screenshots

<!-- TODO: Add screenshots here once available -->

| Dashboard | Invoice Creation | Client Pay Page |
|---|---|---|
| ![Dashboard](https://via.placeholder.com/400x250?text=Dashboard+Screenshot) | ![New Invoice](https://via.placeholder.com/400x250?text=Invoice+Form+Screenshot) | ![Pay Page](https://via.placeholder.com/400x250?text=Pay+Page+Screenshot) |
| Overview of unpaid, overdue, and paid at a glance | Create an invoice in under a minute | Client sees a clean payment page |

> **Placeholder images above.** Replace with actual screenshots as soon as they're available.

---

## Pricing

| Feature | Free | Pro ($12/mo) | Agency ($29/mo) |
|---|---|---|---|
| Monthly invoices | 5 | 50 | Unlimited |
| Automated reminders | ✅ Basic (email) | ✅ Full (email) | ✅ Full (email) |
| SMS / WhatsApp reminders | ❌ | 50/mo | 500/mo |
| AI-generated reminder copy | ❌ | ✅ | ✅ |
| AI receipt scans | 5/mo | 50/mo | 500/mo |
| White-labeled client portal | ❌ | ✅ | ✅ |
| Late fees & interest | ❌ | ✅ | ✅ |
| Xero & QuickBooks sync | ❌ | ✅ | ✅ |
| Expense tracking | ✅ | ✅ | ✅ |
| Bank feed connections (Plaid) | 1 account | 3 accounts | Unlimited |
| Team members | ❌ | ❌ | Up to 5 |
| CSV export | ✅ | ✅ | ✅ |

No credit card required to start. All plans include the core feature: **automatic payment reminders that never forget**.

---

## Who Is This For?

**Freelance designers & developers** — Send a quote → track your hours → convert to invoice → let reminders handle the follow-ups. Set up recurring invoices for retainer clients so you never have to chase.

**Service providers (dog walkers, tutors, cleaners)** — Create a simple invoice from your phone. Your client gets a Stripe payment link and reminder emails. No awkward money conversations.

**Consultants & coaches** — Log expenses for tax time (software, travel, meals). The Tax page estimates what you owe so you never get surprised in April.

**Micro-agencies (2-10 people)** — Team accounts let your bookkeeper or partner work alongside you. White-labeled client portal keeps your brand front and center.

---

## Security & Privacy

- **Token encryption:** All API tokens (Stripe, Plaid, Xero, QuickBooks) are encrypted at rest using **AES-256-GCM** via `crypto.ts` — the same standard banks use.
- **No raw credentials stored:** Plaid uses tokenized access — we never see your bank password. Stripe uses Payment Links — card numbers never touch our servers.
- **HTTPS everywhere:** All traffic is encrypted in transit. Database connections use TLS.
- **Data separation:** Every user's data is isolated by `userId` at the database level. Team data is scoped by `teamId`.
- **Third-party audit trail:** All email sends (Resend), payments (Stripe), and AI calls (OpenAI) are logged with request IDs for traceability.
- **No unnecessary data collection:** We only store what's needed to run the app. No selling or sharing of your data.

---

## Mission

Make small-business finance so simple that a 15-year-old starting their first lawn-mowing business can use it without help — and so powerful that a 10-person agency never outgrows it.

---

## Current Features

[✅] **Invoice management** — Create, edit, view, and organise invoices. Track paid, unpaid, and overdue at a glance.

[✅] **Automated reminder sequences** — 5 escalating email reminders (Gentle → Due Today → Overdue → Firm → Final Notice). Sent automatically at 8am UTC daily. No manual chasing.

[✅] **Bulk CSV import** — Upload dozens of invoices at once from a spreadsheet.

[✅] **Multi-channel reminders** — Email (via Resend), SMS and WhatsApp (via Twilio) for Pro/Agency plans.

[✅] **Stripe payment links** — Clients pay by credit card with one click from the reminder email. Webhooks auto-mark invoices as paid.

[✅] **AI-generated reminder copy** — OpenAI writes personalised reminder emails in your chosen tone (professional, friendly, firm, casual). Approve before sending.

[✅] **AI promise-to-pay detection** — Reads client email replies to detect payment promises. Pauses reminders until the promised date, then sends a follow-up.

[✅] **White-labeled client portal** — Clients get a branded portal to view invoices and pay. No login required — just a magic link.

[✅] **Late payment fees & interest** — Configurable fixed or percentage late fees, daily interest, grace periods, and fee caps.

[✅] **Payment reconciliation** — Matches payments to invoices, flags discrepancies (overpayments, multi-currency, amount mismatches).

[✅] **Xero & QuickBooks integration** — Two-way sync. Pull invoices from your accounting platform, push payment confirmations back.

[✅] **Subscription tiers** — Free (5 invoices/month), Pro ($12/mo, 50 invoices), Agency ($29/mo, unlimited). All features available on paid plans.

[✅] **Client risk profiles** — Every client gets a payment behaviour profile with risk score (Low/Medium/High), on-time rate, average days late, and total paid. Dedicated page with search, sort, and a detailed view including payment history chart and actionable insights.

[✅] **Payment probability scores** — Every unpaid invoice shows a predicted payment likelihood (percentage) with color-coded badge (green ≥80%, yellow 50-80%, red <50%). Based on client history and days overdue. Gated under Pro/Agency plans.

[✅] **Industry benchmarks** — Compare your collection metrics (avg days to pay, collection rate, late payment %) against peers in your industry. Trend chart over time. Dashboard widget shows how you stack up.

[✅] **Cash flow forecasting** — 30/60/90 day projected cash inflows with best/expected/worst scenarios. Area chart with tooltips showing top expected invoices. Recalculated on page load for freshness.

[✅] **Collection efficiency insights** — Track how your reminders perform: conversion rate per template and per channel (email/SMS/WhatsApp), average days from reminder to payment, and payment timing breakdown. Pro/Agency users can download a full PDF report.

[✅] **Predictive alerts & notifications** — Automatic in-app alerts for high-risk invoices (probability <30% and due within 7 days), client payment deterioration (20%+ drop in on-time rate), and cash flow gaps. Notification bell in header with badge count. Filterable notification history page.

---

## UI Component Library

Maroni ships with a dark-themed component library inspired by Linear/Notion/Vercel design patterns. All components live in `app/components/ui/` and use CSS custom properties defined in `app/design-tokens.css`.

| Component | Variants | Props |
|-----------|----------|-------|
| **Button** | `primary` / `secondary` / `ghost` / `danger` | `size` (sm/md/lg), `icon`, `loading`, `href`, `disabled` |
| **Badge** | `unpaid` / `paid` / `overdue` / `cancelled` / `draft` | `variant`, `children` |
| **Table** | Composable (`Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell`) | Standard HTML table attrs |
| **Input** | — | `icon`, `prefix`, `error`, plus native input attrs |
| **Select** | — | `error`, plus native select attrs |
| **Modal** | — | `open`, `onClose`, `title`, `description`, `size` (sm/md/lg), `footer` |
| **EmptyState** | `no-invoices` / `no-clients` / `no-results` | `title`, `description`, `action` |
| **StatCard** | `default` / `highlight` / `warning` | `icon`, `trend`, `loading` |
| **Toast** | via react-hot-toast with pre-styled wrapper | `toast.success()`, `toast.error()`, `toast.custom()` |
| **PageShell** | Page wrapper with title/subtitle/actions | `title`, `subtitle`, `actions`, `children` |

All pages use `PageShell` for consistent layout (title bar + scrollable content area) and `Button`/`Badge`/`Table` for interactive elements.

### Phase A UX Redesign

The entire authenticated UI has been redesigned with a dark theme, collapsible sidebar, and consistent component library. Highlights:
- **Collapsible sidebar** — Expanded (220px) / collapsed (60px) with smooth animation. Mobile slide-over with backdrop.
- **PageShell wrapper** — Every page gets a unified title/subtitle/actions header and scrollable content area.
- **Button overhaul** — Four variants (primary, secondary, ghost, danger) with sizes, icons, and loading states.
- **Badge system** — Status badges with semantic colors (paid=green, overdue=red, unpaid=amber).
- **Composable Table** — Table/TableHead/TableBody/TableRow/TableCell with consistent styling.
- **Modal with animations** — Backdrop blur, Escape-key dismiss, slide-in animation.
- **Toast wrapper** — Dark-themed toast notifications via react-hot-toast.
- **Empty states** — Illustrated empty states with CTAs for no-invoices, no-clients, no-results.

Redesigned pages: Settings (5-tab), Benchmarks, Billing, Promises, Notifications, Reconciliation, Invoices list, Forecast widget, AI Reminder modal, Portal Token modal.

---

## Planned Features

See [NEXT.md](./NEXT.md) for the full roadmap. Highlights:

- **Expense tracking** — Log what you spend. Know your true profit.
- **Tax estimation** — (Income − expenses) × your tax rate. Know what to set aside.
- **Quotes & proposals** — Send a price estimate. Client approves. One click converts to invoice.
- **Time tracking** — Log hours. Generate invoices from unbilled time.
- **Recurring invoices & retainers** — Set once, invoices send themselves.
- **Bank & credit card feeds** (Plaid) — Expenses appear automatically. Just tag them.
- **Invoice PDF generation** — Download invoices as professional PDFs.
- **AI receipt scanning** — Snap a photo. Fields pre-fill. Save.
- **Service catalog** — Save common line items. Add to invoices in one click.
- **Multi-user & teams** — Add your bookkeeper or partner. Role-based access.
- **Client activity timeline** — See every event with a client in one feed.
- **PayPal & bank transfer** — Let clients pay how they want.
- **Accounting overview** — P&L, cash flow, charts — in one page.
- **Mobile-first PWA** — Install on your phone. Works offline.

---

## Getting Started

### 1. Sign up

Visit the app. Enter your email. Click the magic link we send you. Done.

<!-- TODO: Replace with the actual live URL when deployed -->

> **Live demo not yet public.** To run your own instance, follow the Development steps below.

No credit card required. Free plan includes 5 invoices/month with basic reminders.

### 2. Create your first invoice

Click "New Invoice" on the dashboard. Enter the client name, email, amount, and due date. That's it. The app automatically uses your default reminder schedule.

### 3. Let the robot do the chasing

Every morning at 8am UTC, Maroni checks which invoices are unpaid and sends the right reminder. You don't have to think about it.

---

## Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in: DATABASE_URL, RESEND_API_KEY, STRIPE_*, OPENAI_API_KEY, etc.

# Run database migrations
npx prisma db push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tech stack

**Next.js 16.2** (App Router) · **React 19** · **Tailwind CSS v4** · **TypeScript**
**Prisma 4** + **PostgreSQL** (Supabase / Neon)
**NextAuth.js** (magic link auth)
**Resend** (email) · **Twilio** (SMS/WhatsApp) · **Stripe** (payments)
**OpenAI** (AI copy & promise detection)

---

## FAQ

**Is my financial data safe?**  
Yes. API tokens are encrypted with AES-256-GCM. Bank connections use Plaid's tokenized system — we never see your bank password. All traffic is HTTPS. See [Security & Privacy](#security--privacy) above.

**What happens if I go over my invoice limit?**  
You can still access your account and existing invoices, but you won't be able to create new ones until the next billing cycle or until you upgrade.

**Can I cancel anytime?**  
Yes. No contracts, no cancellation fees. You can downgrade from Pro/Agency to Free at any point from the Billing settings page.

**Do my clients need an account to pay?**  
No. Clients receive a payment link via email. They can pay with a credit card (Stripe) without creating any account.

**What currencies do you support?**  
Currently USD, EUR, and GBP. Multi-currency support with live exchange rates is on the roadmap.

**Can I use this outside the US?**  
Yes — as long as Stripe is available in your country. SMS reminders use Twilio (available in 190+ countries). The app itself is region-agnostic.

**Is there a mobile app?**  
Not yet, but the web app is mobile-responsive and can be installed as a PWA on your phone's home screen. A native mobile experience is on the roadmap.

**How do bank feed connections work?**  
We use Plaid, the same service used by Venmo, Betterment, and Robinhood. You select your bank from a searchable list, log in via your bank's own authentication page, and grant read-only access to transactions. We never store your bank credentials.

---

## Feedback & Issues

Found a bug? Have a feature request? We'd love to hear from you.

**Email:** joshuagroth758@gmail.com

Or open an issue on [GitHub](https://github.com/anomalyco/invoice-nudger/issues).

---

## License

MIT

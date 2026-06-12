# Deploying Maroni to Vercel

## Prerequisites

- A [Vercel](https://vercel.com) account
- Your code pushed to a Git provider (GitHub, GitLab, or Bitbucket)
- A production PostgreSQL database (see options below)

### PostgreSQL providers (pick one)

| Provider | Free tier | Notes |
|---|---|---|
| [Neon](https://neon.tech) | 0.5 GB storage, 100 hrs compute/mo | Serverless, good for Vercel |
| [Supabase](https://supabase.com) | 500 MB storage | Includes Postgres + dashboard |
| [AWS RDS](https://aws.amazon.com/rds/) | 12-month free tier (db.t2.micro) | Managed, more setup required |
| [Railway](https://railway.app) | $5/mo after trial | Easy to set up |

---

## Step 1: Import your project into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Project** → select your Git repository
3. Vercel auto-detects Next.js — no framework change needed
4. Leave the default settings:

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `./` |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |

5. Click **Deploy** — it will fail initially because env vars aren't set. That's expected.

---

## Step 2: Set environment variables

Go to your project in the Vercel Dashboard → **Settings** → **Environment Variables**. Add all of the following. Most should be marked **Production** (some can also be added for Preview/Branch deployments if needed).

### Database

| Name | Required | Value |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:password@host:5432/dbname?sslmode=require` |
| `POSTGRES_URL_NON_POOLING` | No | Same as `DATABASE_URL` above (Neon pooler workaround) |

### Auth & App

| Name | Required | Value |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Generate with `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Yes | Your production URL, e.g. `https://maroni.vercel.app` |
| `CRON_SECRET` | Yes | Generate with `openssl rand -hex 32` |

### Email (Resend)

| Name | Required | Value |
|---|---|---|
| `RESEND_API_KEY` | Yes | From [resend.com/api-keys](https://resend.com/api-keys) |
| `EMAIL_FROM` | No | Defaults to `maroni@getmaroni.com` (must verify domain in Resend) |

### Stripe

| Name | Required | Value |
|---|---|---|
| `STRIPE_SECRET_KEY` | Yes | From Stripe Dashboard → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Same page — publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | From Stripe Dashboard → Webhooks → endpoint secret |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | Yes | Price ID for Pro plan (`price_xxx`) |
| `NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID` | Yes | Price ID for Agency plan (`price_xxx`) |
| `STRIPE_PRO_PRICE_ID` | Yes | Same as above |
| `STRIPE_AGENCY_PRICE_ID` | Yes | Same as above |

### Plaid (bank import)

| Name | Required | Value |
|---|---|---|
| `PLAID_CLIENT_ID` | No (free-tier) | From Plaid Dashboard |
| `PLAID_SECRET` | No (free-tier) | From Plaid Dashboard |
| `PLAID_ENVIRONMENT` | No | `sandbox` for testing, `development` or `production` for live |
| `PLAID_PRODUCTS` | No | `transactions` |
| `PLAID_COUNTRY_CODES` | No | `US` |

### Xero integration

| Name | Required | Value |
|---|---|---|
| `XERO_CLIENT_ID` | No | From Xero Developer App |
| `XERO_CLIENT_SECRET` | No | From Xero Developer App |
| `XERO_REDIRECT_URI` | Yes* | `https://maroni.vercel.app/api/integrations/xero/callback` |

### QuickBooks integration

| Name | Required | Value |
|---|---|---|
| `QUICKBOOKS_CLIENT_ID` | No | From QuickBooks Developer App |
| `QUICKBOOKS_CLIENT_SECRET` | No | From QuickBooks Developer App |
| `QUICKBOOKS_REDIRECT_URI` | Yes* | `https://maroni.vercel.app/api/integrations/quickbooks/callback` |

### Token encryption

| Name | Required | Value |
|---|---|---|
| `INTEGRATION_ENCRYPTION_KEY` | Yes* | 32 bytes hex (64 hex chars). Generate: `openssl rand -hex 32` |

### OpenAI

| Name | Required | Value |
|---|---|---|
| `OPENAI_API_KEY` | No (free-tier) | From [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |

### Mailgun (inbound email)

| Name | Required | Value |
|---|---|---|
| `MAILGUN_API_KEY` | No | From Mailgun Dashboard |
| `MAILGUN_DOMAIN` | No | Your Mailgun sending domain |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | No | From Mailgun Dashboard → Webhooks |
| `INBOUND_EMAIL_ADDRESS` | No | `replies@yourdomain.com` |

### Twilio (SMS & WhatsApp)

| Name | Required | Value |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | No (free-tier) | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | No (free-tier) | From Twilio Console |
| `TWILIO_PHONE_NUMBER` | No | Twilio phone number with SMS capability |
| `TWILIO_WHATSAPP_NUMBER` | No | `+14155238886` (Twilio sandbox) |

### PlazaOS integration

| Name | Required | Value |
|---|---|---|
| `MARONI_API_KEY` | No (required for PlazaOS) | Shared secret, e.g. `sk_plazaos_...` |
| `WEBHOOK_SECRET` | No (required for PlazaOS) | Shared secret for HMAC signing, e.g. `whsec_...` |
| `PLAZAOS_WEBHOOK_URL` | No (required for PlazaOS) | PlazaOS webhook endpoint URL |

---

## Step 3: Run database migration

After setting env vars, you need to create the production database tables.

### Option A: Deploy hook (recommended)

1. Go to Vercel Dashboard → **Deploy Hooks** → create a hook
2. Use the hook URL to trigger a manual deploy after migration

### Option B: Manual migration

Run this locally after setting `DATABASE_URL` to point at production:

```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require" npx prisma db push
```

### Option C: GitHub Actions (automated)

```yaml
# .github/workflows/migrate.yml
name: Deploy DB migration
on:
  push:
    branches: [main]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx prisma db push
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Step 4: Trigger a redeploy

1. Go to Vercel Dashboard → **Deployments**
2. Click **Redeploy** on the latest deployment (or push a new commit to your repo)
3. Wait for the build to complete (typically 1–3 minutes)
4. Click **Visit** to open your production URL

---

## Step 5: Configure Cron Jobs

Cron jobs are already defined in `vercel.json`. Verify they're active:

1. Go to Vercel Dashboard → **Cron Jobs**
2. Confirm the following jobs are listed:

| Path | Schedule | Description |
|---|---|---|
| `/api/cron/send-reminders` | Daily 8:00 UTC | Sends invoice reminders |
| `/api/cron/reconcile` | Daily 9:00 UTC | Reconciles payments |
| `/api/cron/process-recurring` | Daily 6:00 UTC | Generates recurring invoices |
| `/api/cron/pay-yourself-reminder` | 1st of month 9:00 UTC | Pay-yourself reminder |
| `/api/cron/sync-bank` | Every 6 hours | Syncs bank transactions |

Each cron endpoint is protected by the `CRON_SECRET` env var. Vercel automatically adds the `Authorization: Bearer <CRON_SECRET>` header — no extra configuration needed.

---

## Step 6: (Optional) Custom domain

1. Go to Vercel Dashboard → **Domains**
2. Enter your domain (e.g. `maroni.yourdomain.com`)
3. Follow the DNS configuration instructions (add CNAME record)
4. Wait for SSL certificate provisioning (auto, ~1 min)

---

## Step 7: Post-deployment verification

### Basic functionality

```bash
# 1. Check the app loads
curl https://maroni.vercel.app

# 2. Check the PlazaOS auth endpoint (should get 401 without key)
curl -i https://maroni.vercel.app/api/plazaos-webhook
# Expect: 401 Missing or invalid API key

# 3. Check with valid key
curl -i \
  -H "X-API-Key: sk_plazaos_..." \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"event":"client.created","client":{"plazaos_client_id":1,"company_name":"Test","contact_name":"Test","email":"test@test.com"}}' \
  https://maroni.vercel.app/api/plazaos-webhook
# Expect: 201 { "client_id": "..." }

# 4. Check dashboard summary
curl -H "X-API-Key: sk_plazaos_..." \
  https://maroni.vercel.app/api/dashboard/summary
# Expect: 200 { "monthlyRevenue": ..., "outstandingTotal": ... }
```

### Stripe webhook (production)

Configure your Stripe webhook endpoint:

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Add endpoint: `https://maroni.vercel.app/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `invoice.payment_succeeded`
4. Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET` in Vercel env vars
5. Redeploy

---

## Step 8: Troubleshooting

### Build fails

**Symptom:** Build log shows error during `npm run build`  
**Check:** All required env vars are set in Vercel Dashboard → Settings → Environment Variables

### Prisma connection error

**Symptom:** "Can't reach database server" in logs  
**Check:**
- `DATABASE_URL` is correct and includes `?sslmode=require`
- Database IP allowlist includes Vercel's IPs (or set to `0.0.0.0/0` for Neon/Supabase)
- Database is running

### 504 Gateway Timeout

**Symptom:** Some pages return 504 after 10 seconds  
**Check:**
- Vercel Serverless Functions have a 10s timeout on Hobby plan
- Upgrade to Pro ($20/mo) for 60s timeout, or Enterprise for 900s
- Optimize slow queries (see `NEXT.md` and `FIX.md` from the codebase)

### Stripe webhook signature mismatch

**Symptom:** Stripe webhook returns 400 "Invalid signature"  
**Check:**
- `STRIPE_WEBHOOK_SECRET` matches the secret in Stripe Dashboard
- The webhook URL is correct and ends with `/api/webhooks/stripe`
- The endpoint in Stripe is set to send the full event payload

### 401 on cron endpoints

**Symptom:** Cron jobs show "Unauthorized" in execution logs  
**Check:**
- Vercel automatically sets `CRON_SECRET` — no manual header needed. If you changed it, make sure Vercel knows the new value.

### 502 Bad Gateway (Blob storage)

**Symptom:** PDF generation or receipt uploads fail  
**Check:**
- `BLOB_READ_WRITE_TOKEN` is set (get from Vercel Dashboard → Storage → Create Blob Store)

---

## Summary checklist

- [ ] Repository connected to Vercel
- [ ] All environment variables set in Vercel Dashboard
- [ ] Production PostgreSQL database created and migrated
- [ ] Initial deployment succeeds (green checkmark)
- [ ] Stripe webhook configured with production endpoint
- [ ] Cron jobs verified in Vercel Dashboard
- [ ] Custom domain added (if applicable)
- [ ] PlazaOS `POST /api/plazaos-webhook` responds 201
- [ ] PlazaOS `GET /api/dashboard/summary` responds 200

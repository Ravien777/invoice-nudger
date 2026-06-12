# Connecting PlazaOS to Maroni

## Prerequisites

Both services must be deployed and reachable. You'll need:

| Variable | Who sets it | Value |
|---|---|---|
| `MARONI_API_KEY` | Maroni dev | A shared secret (e.g. `sk_plazaos_a8f3c...`) |
| `WEBHOOK_SECRET` | Maroni dev | A different shared secret (e.g. `whsec_7b2d1...`) |
| `PLAZAOS_WEBHOOK_URL` | Maroni dev | PlazaOS webhook endpoint, e.g. `https://plazaos.app/api/maroni/webhook` |

---

## Step 1: Exchange credentials (once)

**Maroni side** — set environment variables on deployment:

```
MARONI_API_KEY=sk_plazaos_a8f3c...
WEBHOOK_SECRET=whsec_7b2d1...
PLAZAOS_WEBHOOK_URL=https://plazaos.app/api/maroni/webhook
```

**PlazaOS side** — store the same `MARONI_API_KEY` value. Every request to Maroni will include `X-API-Key: sk_plazaos_a8f3c...`. Maroni will use `WEBHOOK_SECRET` to sign outbound webhooks; PlazaOS verifies the `X-Webhook-Signature` header using the same secret.

---

## Step 2: Sync a client (PlazaOS → Maroni)

When PlazaOS creates or updates a client record, call:

```http
POST https://maroni.app/api/plazaos-webhook
X-API-Key: sk_plazaos_a8f3c...
Content-Type: application/json

{
  "event": "client.created",
  "client": {
    "plazaos_client_id": 42,
    "company_name": "Acme Corp",
    "contact_name": "John Doe",
    "email": "john@acme.com",
    "phone": "+1234567890",
    "website": "https://acme.com",
    "industry": "Technology",
    "city": "San Francisco",
    "country": "US",
    "status": "active"
  }
}
```

**Response** (201):

```json
{ "client_id": "mrn_cli_abc123" }
```

Store `client_id` on the PlazaOS client record as `maroni_client_id` — you'll use it in Step 3.

For updates, send `"event": "client.updated"` with the same `plazaos_client_id`. Maroni finds the existing record and updates all fields. It also fires a `client.updated` webhook back to PlazaOS (see Step 4).

---

## Step 3: Read Maroni data (PlazaOS → Maroni)

All GET endpoints require the `X-API-Key` header. Use the `client_id` from Step 2.

### Invoices

```
GET https://maroni.app/api/clients/mrn_cli_abc123/invoices
X-API-Key: sk_plazaos_a8f3c...
```

```json
{
  "invoices": [
    {
      "id": "inv_001",
      "number": "INV-2026-001",
      "amount": 2500.00,
      "status": "pending",
      "date": "2026-01-15",
      "url": "https://maroni.app/invoices/inv_001"
    }
  ]
}
```

### Expenses

```
GET https://maroni.app/api/clients/mrn_cli_abc123/expenses
X-API-Key: sk_plazaos_a8f3c...
```

```json
{
  "expenses": [
    {
      "id": "exp_001",
      "description": "AWS Hosting",
      "amount": 150.0,
      "category": "Infrastructure",
      "date": "2026-01-10"
    }
  ]
}
```

### Client summary

```
GET https://maroni.app/api/clients/mrn_cli_abc123/summary
X-API-Key: sk_plazaos_a8f3c...
```

```json
{
  "totalBilled": 10000.0,
  "totalPaid": 7500.0,
  "outstanding": 2500.0
}
```

### Dashboard aggregate

```
GET https://maroni.app/api/dashboard/summary
X-API-Key: sk_plazaos_a8f3c...
```

```json
{
  "monthlyRevenue": 45000.0,
  "outstandingTotal": 12000.0
}
```

---

## Step 4: Receive webhooks (Maroni → PlazaOS)

Configure a PlazaOS endpoint to receive Maroni's webhooks at the URL you provided as `PLAZAOS_WEBHOOK_URL`.

### Verify the signature

Every webhook request includes:

```
X-Webhook-Signature: <hmac_sha256(raw_request_body, webhook_secret)>
```

Verify it in your handler:

```js
import { createHmac } from "crypto";

function verifyWebhook(rawBody, signatureHeader, webhookSecret) {
  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}
```

### Events you'll receive

#### `invoice.created`

Sent when a new invoice is created in Maroni for a synced client.

```json
{
  "event": "invoice.created",
  "data": { "client_id": "mrn_cli_abc123", "invoice_id": "inv_001" }
}
```

#### `invoice.paid`

Sent when an invoice is marked as paid.

```json
{
  "event": "invoice.paid",
  "data": { "client_id": "mrn_cli_abc123", "invoice_id": "inv_001" }
}
```

#### `client.updated`

Sent when a client record is updated via the webhook.

```json
{
  "event": "client.updated",
  "data": { "client_id": "mrn_cli_abc123" }
}
```

### Expected response

- **Success:** Respond with `{ "status": "ok" }` and HTTP 200.
- **Failure:** Any non-2xx response is considered a failure and logged by Maroni.

---

## Step 5: Verify end-to-end

1. **PlazaOS creates a client** → `POST /api/plazaos-webhook` → receives `client_id`
2. **PlazaOS fetches invoices** for that client → `GET /api/clients/:id/invoices`
3. **Someone creates an invoice in Maroni** for the same client email → Maroni fires `invoice.created` webhook to PlazaOS
4. **Invoice is paid** in Maroni → Maroni fires `invoice.paid` webhook to PlazaOS
5. **PlazaOS updates the client** → Maroni fires `client.updated` webhook back to PlazaOS
6. **PlazaOS fetches dashboard** → `GET /api/dashboard/summary` for aggregate numbers

---

## Error codes

| Status | Meaning |
|---|---|
| 401 | Missing or invalid `X-API-Key` |
| 404 | Client not found (check `maroniClientId`) |
| 400 | Validation error (check response body for details) |
| 5xx | Server error — check Maroni logs |

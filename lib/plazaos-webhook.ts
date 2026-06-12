import { createHmac } from "crypto";

const WEBHOOK_SECRET = () => process.env.WEBHOOK_SECRET || "";
const PLAZAOS_WEBHOOK_URL = () => process.env.PLAZAOS_WEBHOOK_URL || "";

export function signWebhookPayload(rawBody: string): string {
  return createHmac("sha256", WEBHOOK_SECRET())
    .update(rawBody)
    .digest("hex");
}

export async function sendWebhook(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const url = PLAZAOS_WEBHOOK_URL();
  if (!url) return;

  const payload = JSON.stringify({ event, data });
  const signature = signWebhookPayload(payload);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body: payload,
    });

    if (!res.ok) {
      console.error(
        `[plazaos-webhook] ${event} failed: ${res.status} ${res.statusText}`
      );
    }
  } catch (err) {
    console.error(`[plazaos-webhook] ${event} error:`, err);
  }
}

import { createHmac, randomBytes } from "crypto";
import { prisma } from "./prisma";

const RETRY_DELAYS_SEC = [60, 300, 900]; // 1min, 5min, 15min
const MAX_RETRIES = 3;

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliverToEndpoint(
  endpointId: string,
  url: string,
  secret: string,
  event: string,
  payload: object,
) {
  const body = JSON.stringify({
    event,
    data: payload,
    sentAt: new Date().toISOString(),
  });

  const signature = signPayload(body, secret);
  const start = Date.now();

  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  let status: "success" | "failed" = "success";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event,
        "User-Agent": "Maroni-Webhook/1.0",
      },
      body,
    });

    responseCode = res.status;
    if (!res.ok) {
      responseBody = await res.text().catch(() => null);
      status = "failed";
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  const durationMs = Date.now() - start;
  const attemptNumber = status === "failed" ? 1 : 1;

  let nextRetryAt: Date | null = null;
  let deliveryStatus = status;

  if (status === "failed" && attemptNumber < MAX_RETRIES) {
    nextRetryAt = new Date(Date.now() + RETRY_DELAYS_SEC[0] * 1000);
  }

  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId,
      event,
      payload: payload as any,
      status: deliveryStatus,
      responseCode,
      responseBody,
      durationMs,
      errorMessage,
      attemptNumber,
      nextRetryAt,
      deliveredAt: status === "success" ? new Date() : null,
    },
  });

  if (status === "success") {
    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { lastDeliveredAt: new Date() },
    });
  }

  return delivery;
}

export async function dispatchWebhook(
  userId: string,
  event: string,
  payload: object,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId, status: "active", events: { has: event } },
  });

  for (const endpoint of endpoints) {
    deliverToEndpoint(endpoint.id, endpoint.url, endpoint.secret, event, payload)
      .catch((err) => console.error(`[webhook-dispatcher] Delivery error:`, err));
  }
}

export async function retryFailedDeliveries(): Promise<number> {
  const now = new Date();

  const retries = (await (prisma.webhookDelivery.findMany as any)({
    where: {
      status: "failed",
      nextRetryAt: { lte: now },
      attemptNumber: { lt: MAX_RETRIES },
    },
    include: {
      endpoint: {
        select: { url: true, secret: true },
      },
    },
  })) as Array<{
    id: string;
    endpointId: string;
    event: string;
    payload: Record<string, unknown>;
    attemptNumber: number;
    endpoint: { url: string; secret: string };
  }>;

  for (const delivery of retries) {
    const attemptNumber = delivery.attemptNumber + 1;
    const delayIdx = Math.min(attemptNumber - 1, RETRY_DELAYS_SEC.length - 1);
    const delaySec = RETRY_DELAYS_SEC[delayIdx];

    const body = JSON.stringify({
      event: delivery.event,
      data: delivery.payload,
      sentAt: new Date().toISOString(),
    });

    const signature = signPayload(body, delivery.endpoint.secret);
    const start = Date.now();

    let responseCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let status: "success" | "failed" = "success";

    try {
      const res = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": delivery.event,
          "User-Agent": "Maroni-Webhook/1.0",
        },
        body,
      });

      responseCode = res.status;
      if (!res.ok) {
        responseBody = await res.text().catch(() => null);
        status = "failed";
      }
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    const durationMs = Date.now() - start;
    let nextRetryAt: Date | null = null;

    if (status === "failed" && attemptNumber < MAX_RETRIES) {
      nextRetryAt = new Date(Date.now() + delaySec * 1000);
    }

    await prisma.webhookDelivery.create({
      data: {
        endpointId: delivery.endpointId,
        event: delivery.event,
        payload: delivery.payload as any,
        status,
        responseCode,
        responseBody,
        durationMs,
        errorMessage,
        attemptNumber,
        nextRetryAt,
        deliveredAt: status === "success" ? new Date() : null,
      },
    });
  }

  return retries.length;
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

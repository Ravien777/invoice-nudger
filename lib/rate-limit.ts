import { prisma } from "./prisma";

const WINDOW_MS = 60_000;

function getWindowStart(): Date {
  const now = Date.now();
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
}

export async function rateLimit(
  keyId: string,
  maxRequests: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = getWindowStart();

  const record = await prisma.apiRateLimit.upsert({
    where: {
      keyId_windowStart: { keyId, windowStart },
    },
    create: { keyId, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  const remaining = Math.max(0, maxRequests - record.count);
  const allowed = record.count <= maxRequests;

  return { allowed, remaining };
}

// In-memory rate limit for non-DB contexts (login attempts, etc.)
const memoryMap = new Map<string, { count: number; resetTime: number }>();

export function memoryRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 1000,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = memoryMap.get(key);

  if (!record || now > record.resetTime) {
    memoryMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  record.count++;
  if (record.count > maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxAttempts - record.count };
}

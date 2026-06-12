import { createHash } from "crypto";
import { prisma } from "./prisma";
import { rateLimit } from "./rate-limit";
import { getTier } from "./tiers";

export interface ApiAuthResult {
  userId: string;
  keyId: string;
  scopes: string;
}

export async function authenticateApiKey(
  request: Request,
  requiredScope: "read" | "write" = "read",
): Promise<ApiAuthResult | { error: string; status: number }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const key = authHeader.slice(7).trim();
  if (!key) {
    return { error: "Missing API key", status: 401 };
  }

  const keyHash = createHash("sha256").update(key).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      scopes: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!apiKey) {
    return { error: "Invalid API key", status: 401 };
  }

  if (apiKey.status !== "active") {
    return { error: "API key is revoked", status: 401 };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { error: "API key has expired", status: 401 };
  }

  if (requiredScope === "write" && apiKey.scopes !== "write" && apiKey.scopes !== "admin") {
    return { error: "Insufficient permissions", status: 403 };
  }

  const user = await prisma.user.findUnique({
    where: { id: apiKey.userId },
    select: { plan: true },
  });

  if (!user) {
    return { error: "User not found", status: 404 };
  }

  const tier = getTier(user.plan);

  if (tier.apiKeysLimit === 0) {
    return { error: "API access not available on your plan", status: 403 };
  }

  const rl = await rateLimit(apiKey.id, tier.apiRateLimit);

  if (!rl.allowed) {
    return { error: "Rate limit exceeded", status: 429 };
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    userId: apiKey.userId,
    keyId: apiKey.id,
    scopes: apiKey.scopes,
  };
}

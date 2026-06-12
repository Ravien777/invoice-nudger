import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "fallback-secret-do-not-use";

export function signQuoteToken(quoteId: string): string {
  const hmac = createHmac("sha256", SECRET);
  hmac.update(quoteId);
  return hmac.digest("hex");
}

export function verifyQuoteToken(token: string, quoteId: string): boolean {
  if (!token || !quoteId) return false;
  const expected = signQuoteToken(quoteId);
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

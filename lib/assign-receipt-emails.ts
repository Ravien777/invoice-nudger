import { prisma } from "./prisma";

const RECEIPT_DOMAIN = process.env.RECEIPT_EMAIL_DOMAIN ?? "mail.getmaroni.com";

export async function assignReceiptEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (user.receiptEmail) return user.receiptEmail;

  const receiptEmail = `receipts.${userId}@${RECEIPT_DOMAIN}`;
  await prisma.user.update({
    where: { id: userId },
    data: { receiptEmail },
  });
  return receiptEmail;
}

export function buildReceiptEmail(userId: string): string {
  return `receipts.${userId}@${RECEIPT_DOMAIN}`;
}

export function parseReceiptAddress(to: string): { userId: string } | null {
  const match = to.match(/^receipts\.([a-z0-9]+)@/i);
  if (!match) return null;
  return { userId: match[1] };
}

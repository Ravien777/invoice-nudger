import { prisma } from "./prisma";
import { formatCurrency } from "./format-currency";

const DEFAULT_TAX_PCT = 25;
const DEFAULT_OPERATING_PCT = 30;
const DEFAULT_PROFIT_PCT = 5;
const DEFAULT_OWNER_PAY_PCT = 40;

export async function createAllocationRecord(
  userId: string,
  totalReceived: number,
  currency: string,
  invoiceId?: string,
) {
  const profile = await prisma.allocationProfile.findUnique({
    where: { userId },
  });

  const taxPct = profile?.taxPercent ?? DEFAULT_TAX_PCT;
  const operatingPct = profile?.operatingPercent ?? DEFAULT_OPERATING_PCT;
  const profitPct = profile?.profitPercent ?? DEFAULT_PROFIT_PCT;
  const ownerPayPct = profile?.ownerPayPercent ?? DEFAULT_OWNER_PAY_PCT;

  const taxAmount = round2(totalReceived * (taxPct / 100));
  const operatingAmount = round2(totalReceived * (operatingPct / 100));
  const profitAmount = round2(totalReceived * (profitPct / 100));
  const ownerPayAmount = round2(totalReceived * (ownerPayPct / 100));

  const record = await prisma.allocationRecord.create({
    data: {
      userId,
      totalReceived,
      taxAmount,
      operatingAmount,
      profitAmount,
      ownerPayAmount,
      currency,
      invoiceId: invoiceId ?? null,
    },
  });

  const formattedAmount = formatCurrency(totalReceived, currency);

  await prisma.notification.create({
    data: {
      userId,
      type: "allocation",
      title: "Income Allocated",
      message: `${formattedAmount} received — allocated across tax, business, profit, and your pay.`,
      metadata: { allocationRecordId: record.id, invoiceId: invoiceId ?? null },
    },
  });

  return record;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

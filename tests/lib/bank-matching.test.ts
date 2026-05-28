import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockTx(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx-1",
    userId: "user-1",
    connectionId: "conn-1",
    externalId: "plaid-tx-1",
    date: new Date("2025-06-15"),
    description: "ACME CORP PAYMENT",
    amount: 500,
    currency: "USD",
    category: "income",
    matchedInvoiceId: null,
    matchedExpenseId: null,
    status: "unmatched",
    createdAt: new Date("2025-06-15"),
    ...overrides,
  } as any;
}

describe("autoMatchTransaction (credit -> invoice)", () => {
  it("matches a single invoice within tolerance", async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue(mockTx({ amount: 500 }));
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv-1", userId: "user-1", status: "unpaid", amount: 500, dueDate: new Date("2025-06-18") },
    ] as any);

    const { autoMatchTransaction } = await import("@/lib/bank-matching");
    await autoMatchTransaction("tx-1");

    expect(prisma.bankTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-1" },
        data: expect.objectContaining({ matchedInvoiceId: "inv-1", status: "matched" }),
      }),
    );
  });

  it("does not match if multiple candidates", async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue(mockTx({ amount: 500 }));
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv-1", amount: 500 },
      { id: "inv-2", amount: 500 },
    ] as any);

    const { autoMatchTransaction } = await import("@/lib/bank-matching");
    await autoMatchTransaction("tx-1");

    expect(prisma.bankTransaction.update).not.toHaveBeenCalled();
  });

  it("does not match if no candidates", async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue(mockTx({ amount: 500 }));
    prisma.invoice.findMany.mockResolvedValue([]);

    const { autoMatchTransaction } = await import("@/lib/bank-matching");
    await autoMatchTransaction("tx-1");

    expect(prisma.bankTransaction.update).not.toHaveBeenCalled();
  });
});

describe("autoMatchTransaction (debit -> expense)", () => {
  it("matches a single expense within tolerance", async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue(mockTx({ amount: -150, description: "ADOBE SUBSCRIPTION" }));
    prisma.expense.findMany.mockResolvedValue([
      { id: "exp-1", userId: "user-1", amount: 150, date: new Date("2025-06-15") },
    ] as any);

    const { autoMatchTransaction } = await import("@/lib/bank-matching");
    await autoMatchTransaction("tx-1");

    expect(prisma.bankTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-1" },
        data: expect.objectContaining({ matchedExpenseId: "exp-1", status: "matched" }),
      }),
    );
  });

  it("does not match if amount outside tolerance", async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue(mockTx({ amount: -150 }));
    prisma.expense.findMany.mockResolvedValue([]);

    const { autoMatchTransaction } = await import("@/lib/bank-matching");
    await autoMatchTransaction("tx-1");

    expect(prisma.bankTransaction.update).not.toHaveBeenCalled();
  });

  it("skips if transaction is not unmatched", async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue(mockTx({ status: "matched" }));

    const { autoMatchTransaction } = await import("@/lib/bank-matching");
    await autoMatchTransaction("tx-1");

    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });
});

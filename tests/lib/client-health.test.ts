import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";
import {
  getClientLabel,
  computeClientAvgDaysToPayScore,
  computeClientPaymentRateScore,
  computeClientDisputeRateScore,
  calculateClientHealthScore,
  calculateAllClientHealthScores,
} from "@/lib/client-health";

describe("getClientLabel", () => {
  it("returns Excellent for score >= 85", () => {
    expect(getClientLabel(100)).toBe("Excellent");
    expect(getClientLabel(85)).toBe("Excellent");
  });

  it("returns Good for score 65-84", () => {
    expect(getClientLabel(75)).toBe("Good");
    expect(getClientLabel(65)).toBe("Good");
  });

  it("returns Average for score 45-64", () => {
    expect(getClientLabel(55)).toBe("Average");
    expect(getClientLabel(45)).toBe("Average");
  });

  it("returns Slow Payer for score 25-44", () => {
    expect(getClientLabel(35)).toBe("Slow Payer");
    expect(getClientLabel(25)).toBe("Slow Payer");
  });

  it("returns High Risk for score < 25", () => {
    expect(getClientLabel(10)).toBe("High Risk");
    expect(getClientLabel(0)).toBe("High Risk");
  });
});

describe("computeClientAvgDaysToPayScore", () => {
  it("gives 25 points for < 15 days", () => {
    expect(computeClientAvgDaysToPayScore(10).score).toBe(25);
  });

  it("gives 20 points for 15-30 days", () => {
    expect(computeClientAvgDaysToPayScore(20).score).toBe(20);
  });

  it("gives 15 points for 30-45 days", () => {
    expect(computeClientAvgDaysToPayScore(38).score).toBe(15);
  });

  it("gives 10 points for 45-60 days", () => {
    expect(computeClientAvgDaysToPayScore(52).score).toBe(10);
  });

  it("gives 5 points for 60+ days", () => {
    expect(computeClientAvgDaysToPayScore(70).score).toBe(5);
  });

  it("gives partial score when no history", () => {
    expect(computeClientAvgDaysToPayScore(null).score).toBe(12);
  });
});

describe("computeClientPaymentRateScore", () => {
  it("gives 25 points for 100% payment rate", () => {
    const result = computeClientPaymentRateScore(10, 10);
    expect(result.score).toBe(25);
  });

  it("gives proportional score", () => {
    const result = computeClientPaymentRateScore(5, 10);
    expect(result.score).toBe(13);
  });

  it("gives partial score when no invoices", () => {
    const result = computeClientPaymentRateScore(0, 0);
    expect(result.score).toBe(12);
    expect(result.details).toContain("No invoices yet");
  });
});

describe("computeClientDisputeRateScore", () => {
  it("gives 25 points for no problematic invoices", () => {
    const result = computeClientDisputeRateScore(5, [
      { status: "paid", paidAt: new Date(), dueDate: new Date() },
      { status: "paid", paidAt: new Date(), dueDate: new Date() },
    ]);
    expect(result.score).toBe(25);
  });

  it("gives 0 points when half are problematic", () => {
    const ninetyDaysAgo = new Date(Date.now() - 100 * 86400000);
    const result = computeClientDisputeRateScore(4, [
      { status: "unpaid", paidAt: null, dueDate: ninetyDaysAgo },
      { status: "unpaid", paidAt: null, dueDate: ninetyDaysAgo },
      { status: "paid", paidAt: new Date(), dueDate: new Date() },
      { status: "paid", paidAt: new Date(), dueDate: new Date() },
    ]);
    expect(result.score).toBe(0);
  });
});

describe("calculateClientHealthScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scores excellent client correctly", async () => {
    vi.mocked(prisma.clientPaymentProfile.findUnique).mockResolvedValue({
      id: "p1",
      userId: "user-1",
      clientEmail: "good@client.com",
      totalInvoices: 10,
      paidInvoices: 10,
      onTimePayments: 9,
      totalAmount: 50000,
      avgDaysLate: 10,
      lastPaymentDate: new Date(),
      riskScore: 0.1,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([
        { status: "paid", paidAt: new Date(), dueDate: new Date() },
        { status: "paid", paidAt: new Date(), dueDate: new Date() },
      ] as any)
      .mockResolvedValueOnce([
        { promiseStatus: "fulfilled" },
        { promiseStatus: "fulfilled" },
      ] as any);

    const result = await calculateClientHealthScore(
      "user-1",
      "good@client.com",
    );
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.label).toBe("Excellent");
  });

  it("scores slow payer correctly", async () => {
    vi.mocked(prisma.clientPaymentProfile.findUnique).mockResolvedValue({
      id: "p2",
      userId: "user-1",
      clientEmail: "slow@client.com",
      totalInvoices: 10,
      paidInvoices: 3,
      onTimePayments: 1,
      totalAmount: 15000,
      avgDaysLate: 55,
      lastPaymentDate: new Date(),
      riskScore: 0.8,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([
        { status: "unpaid", paidAt: null, dueDate: new Date(Date.now() - 95 * 86400000) },
        { status: "paid", paidAt: new Date(), dueDate: new Date() },
        { status: "unpaid", paidAt: null, dueDate: new Date(Date.now() - 10 * 86400000) },
      ] as any)
      .mockResolvedValueOnce([] as any);

    const result = await calculateClientHealthScore(
      "user-1",
      "slow@client.com",
    );
    expect(result.score).toBeLessThan(60);
    expect(["Average", "Slow Payer", "High Risk"]).toContain(result.label);
  });

  it("handles client with no invoices", async () => {
    vi.mocked(prisma.clientPaymentProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

    const result = await calculateClientHealthScore(
      "user-1",
      "new@client.com",
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(65);
  });

  it("returns signals for low-scoring areas", async () => {
    vi.mocked(prisma.clientPaymentProfile.findUnique).mockResolvedValue({
      id: "p3",
      userId: "user-1",
      clientEmail: "risky@client.com",
      totalInvoices: 5,
      paidInvoices: 1,
      onTimePayments: 0,
      totalAmount: 10000,
      avgDaysLate: 65,
      lastPaymentDate: new Date(),
      riskScore: 0.9,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([
        { status: "unpaid", paidAt: null, dueDate: new Date(Date.now() - 100 * 86400000) },
        { status: "unpaid", paidAt: null, dueDate: new Date(Date.now() - 50 * 86400000) },
      ] as any)
      .mockResolvedValueOnce([] as any);

    const result = await calculateClientHealthScore(
      "user-1",
      "risky@client.com",
    );
    expect(result.signals.length).toBeGreaterThan(0);
  });
});

describe("calculateAllClientHealthScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns scores for all clients", async () => {
    vi.mocked(prisma.clientPaymentProfile.findMany).mockResolvedValue([
      { clientEmail: "a@test.com" },
      { clientEmail: "b@test.com" },
    ] as any);

    vi.mocked(prisma.clientPaymentProfile.findUnique).mockResolvedValue({
      id: "p1",
      userId: "user-1",
      clientEmail: "a@test.com",
      totalInvoices: 5,
      paidInvoices: 5,
      onTimePayments: 5,
      totalAmount: 25000,
      avgDaysLate: 8,
      lastPaymentDate: new Date(),
      riskScore: 0.1,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([
        { status: "paid", paidAt: new Date(), dueDate: new Date() },
      ] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([
        { status: "paid", paidAt: new Date(), dueDate: new Date() },
      ] as any)
      .mockResolvedValueOnce([] as any);

    const results = await calculateAllClientHealthScores("user-1");
    expect(results).toHaveLength(2);
    results.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });

  it("returns empty array when no clients", async () => {
    vi.mocked(prisma.clientPaymentProfile.findMany).mockResolvedValue([]);
    const results = await calculateAllClientHealthScores("user-1");
    expect(results).toHaveLength(0);
  });
});

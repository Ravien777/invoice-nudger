import { describe, it, expect } from "vitest";
import {
  computeCollectionRateScore,
  computeAvgDaysToPayScore,
  computeRevenueConsistencyScore,
  computeExpenseRatioScore,
  computeTaxReserveScore,
  generateTips,
} from "@/lib/health-score";

describe("computeCollectionRateScore", () => {
  it("gives 30 points for 95%+ collection rate", () => {
    const result = computeCollectionRateScore(19, 20);
    expect(result.score).toBe(30);
    expect(result.maxScore).toBe(30);
  });

  it("gives 24 points for 80% collection rate", () => {
    const result = computeCollectionRateScore(8, 10);
    expect(result.score).toBe(24);
  });

  it("gives 18 points for 60% collection rate", () => {
    const result = computeCollectionRateScore(6, 10);
    expect(result.score).toBe(18);
  });

  it("gives 10 points for 40% collection rate", () => {
    const result = computeCollectionRateScore(4, 10);
    expect(result.score).toBe(10);
  });

  it("gives 5 points for below 40% collection rate", () => {
    const result = computeCollectionRateScore(3, 10);
    expect(result.score).toBe(5);
  });

  it("handles zero total invoices", () => {
    const result = computeCollectionRateScore(0, 0);
    expect(result.score).toBe(5);
    expect(result.details).toContain("0%");
  });
});

describe("computeAvgDaysToPayScore", () => {
  it("gives 20 points for avg < 20 days", () => {
    expect(computeAvgDaysToPayScore(15).score).toBe(20);
  });

  it("gives 15 points for avg 20-35 days", () => {
    expect(computeAvgDaysToPayScore(25).score).toBe(15);
  });

  it("gives 10 points for avg 35-50 days", () => {
    expect(computeAvgDaysToPayScore(42).score).toBe(10);
  });

  it("gives 5 points for avg 50+ days", () => {
    expect(computeAvgDaysToPayScore(60).score).toBe(5);
  });

  it("gives partial score when no payment history", () => {
    const result = computeAvgDaysToPayScore(null);
    expect(result.score).toBe(10);
    expect(result.details).toContain("No payment history");
  });
});

describe("computeRevenueConsistencyScore", () => {
  it("gives 20 points for low variance revenue", () => {
    const result = computeRevenueConsistencyScore([5000, 5100, 4900, 5050, 4950, 5100]);
    expect(result.score).toBe(20);
  });

  it("gives 0 points for no data", () => {
    const result = computeRevenueConsistencyScore([]);
    expect(result.score).toBe(0);
    expect(result.details).toContain("No revenue data");
  });

  it("prorates for fewer than 6 months", () => {
    const result = computeRevenueConsistencyScore([5000, 5100, 4900]);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(20);
  });

  it("gives lower score for high variance", () => {
    const low = computeRevenueConsistencyScore([5000, 5000, 5000, 5000, 5000, 5000]);
    const high = computeRevenueConsistencyScore([1000, 10000, 500, 15000, 2000, 8000]);
    expect(low.score).toBeGreaterThan(high.score);
  });
});

describe("computeExpenseRatioScore", () => {
  it("gives 15 points for expense ratio under 30%", () => {
    const result = computeExpenseRatioScore(1000, 5000);
    expect(result.score).toBe(15);
  });

  it("gives 10 points for expense ratio 30-50%", () => {
    const result = computeExpenseRatioScore(2000, 5000);
    expect(result.score).toBe(10);
  });

  it("gives 5 points for expense ratio 50-70%", () => {
    const result = computeExpenseRatioScore(3000, 5000);
    expect(result.score).toBe(5);
  });

  it("gives 0 points for expense ratio over 70%", () => {
    const result = computeExpenseRatioScore(4000, 5000);
    expect(result.score).toBe(0);
  });

  it("gives partial score when no income yet", () => {
    const result = computeExpenseRatioScore(500, 0);
    expect(result.score).toBe(10);
    expect(result.details).toContain("No income yet");
  });
});

describe("computeTaxReserveScore", () => {
  it("gives 15 points when profile and records exist", () => {
    const result = computeTaxReserveScore(true, true);
    expect(result.score).toBe(15);
  });

  it("gives 7 points when profile exists but no records", () => {
    const result = computeTaxReserveScore(true, false);
    expect(result.score).toBe(7);
  });

  it("gives 0 points when no profile", () => {
    const result = computeTaxReserveScore(false, false);
    expect(result.score).toBe(0);
  });
});

describe("generateTips", () => {
  it("generates tip for low collection rate", () => {
    const tips = generateTips({
      collectionRate: { score: 5, maxScore: 30, details: "Collection rate: 10%" },
      avgDaysToPay: { score: 20, maxScore: 20, details: "" },
      revenueConsistency: { score: 20, maxScore: 20, details: "" },
      expenseRatio: { score: 15, maxScore: 15, details: "" },
      taxReserve: { score: 15, maxScore: 15, details: "" },
    });
    expect(tips.some((t) => t.toLowerCase().includes("collection"))).toBe(true);
  });

  it("generates tip for slow payments", () => {
    const tips = generateTips({
      collectionRate: { score: 30, maxScore: 30, details: "" },
      avgDaysToPay: { score: 5, maxScore: 20, details: "Avg 60 days to pay" },
      revenueConsistency: { score: 20, maxScore: 20, details: "" },
      expenseRatio: { score: 15, maxScore: 15, details: "" },
      taxReserve: { score: 15, maxScore: 15, details: "" },
    });
    expect(tips.some((t) => t.toLowerCase().includes("payment"))).toBe(true);
  });

  it("generates tip for high expense ratio", () => {
    const tips = generateTips({
      collectionRate: { score: 30, maxScore: 30, details: "" },
      avgDaysToPay: { score: 20, maxScore: 20, details: "" },
      revenueConsistency: { score: 20, maxScore: 20, details: "" },
      expenseRatio: { score: 5, maxScore: 15, details: "Expense ratio: 60%" },
      taxReserve: { score: 15, maxScore: 15, details: "" },
    });
    expect(tips.some((t) => t.toLowerCase().includes("expense"))).toBe(true);
  });

  it("generates tip for missing tax reserve", () => {
    const tips = generateTips({
      collectionRate: { score: 30, maxScore: 30, details: "" },
      avgDaysToPay: { score: 20, maxScore: 20, details: "" },
      revenueConsistency: { score: 20, maxScore: 20, details: "" },
      expenseRatio: { score: 15, maxScore: 15, details: "" },
      taxReserve: { score: 0, maxScore: 15, details: "No tax reserve tracking" },
    });
    expect(tips.some((t) => t.toLowerCase().includes("tax"))).toBe(true);
  });

  it("returns no tips when all scores are high", () => {
    const tips = generateTips({
      collectionRate: { score: 30, maxScore: 30, details: "" },
      avgDaysToPay: { score: 20, maxScore: 20, details: "" },
      revenueConsistency: { score: 20, maxScore: 20, details: "" },
      expenseRatio: { score: 15, maxScore: 15, details: "" },
      taxReserve: { score: 15, maxScore: 15, details: "" },
    });
    expect(tips.length).toBe(0);
  });
});

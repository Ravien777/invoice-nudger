import { describe, it, expect } from "vitest";
import { computeRiskScore, calculatePaymentProbability } from "@/lib/analytics";

describe("computeRiskScore", () => {
  // computeRiskScore returns a value between 0 (best) and 1 (worst)
  it("returns 0 for 100% on-time ratio with no late days", () => {
    expect(computeRiskScore(1, null)).toBe(0);
  });

  it("returns 0.7 for 0% on-time ratio with no late days", () => {
    // (1 - 0) * 0.7 + 0 * 0.3 = 0.7
    expect(computeRiskScore(0, null)).toBe(0.7);
  });

  it("returns 1 for 0% on-time ratio with 30+ late days", () => {
    // (1 - 0) * 0.7 + min(30, 30)/30 * 0.3 = 0.7 + 0.3 = 1
    expect(computeRiskScore(0, 30)).toBe(1);
  });

  it("increases score with more late days", () => {
    const low = computeRiskScore(0.5, 0);
    const high = computeRiskScore(0.5, 30);
    expect(high).toBeGreaterThan(low);
  });

  it("returns between 0 and 1 for various inputs", () => {
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      for (const late of [null, 0, 15, 30, 60]) {
        const score = computeRiskScore(ratio, late);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("calculatePaymentProbability", () => {
  it("returns 0.7 for null profile (new client)", () => {
    const prob = calculatePaymentProbability(null, {
      dueDate: new Date(Date.now() + 7 * 86400000),
      amount: 1000,
    });
    expect(prob).toBe(0.7);
  });

  it("returns 0.7 for empty payment history", () => {
    const prob = calculatePaymentProbability(
      { paidInvoices: 0, onTimePayments: 0, avgDaysLate: null },
      { dueDate: new Date(Date.now() + 7 * 86400000), amount: 1000 },
    );
    expect(prob).toBe(0.7);
  });

  it("returns higher probability for clients with good history", () => {
    const good = calculatePaymentProbability(
      { paidInvoices: 10, onTimePayments: 9, avgDaysLate: 2 },
      { dueDate: new Date(Date.now() + 7 * 86400000), amount: 1000 },
    );
    const bad = calculatePaymentProbability(
      { paidInvoices: 10, onTimePayments: 1, avgDaysLate: 25 },
      { dueDate: new Date(Date.now() + 7 * 86400000), amount: 1000 },
    );
    expect(good).toBeGreaterThan(bad);
  });

  it("returns lower probability for past-due invoices", () => {
    const future = calculatePaymentProbability(
      { paidInvoices: 5, onTimePayments: 4, avgDaysLate: 5 },
      { dueDate: new Date(Date.now() + 7 * 86400000), amount: 1000 },
    );
    const past = calculatePaymentProbability(
      { paidInvoices: 5, onTimePayments: 4, avgDaysLate: 5 },
      { dueDate: new Date(Date.now() - 30 * 86400000), amount: 1000 },
    );
    expect(past).toBeLessThan(future);
  });

  it("returns a number between 0 and 1", () => {
    const profiles = [
      null,
      { paidInvoices: 0, onTimePayments: 0, avgDaysLate: null },
      { paidInvoices: 10, onTimePayments: 9, avgDaysLate: 5 },
      { paidInvoices: 3, onTimePayments: 0, avgDaysLate: 30 },
    ];
    for (const profile of profiles) {
      const prob = calculatePaymentProbability(profile, {
        dueDate: new Date(Date.now() + 7 * 86400000),
        amount: 1000,
      });
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }
  });
});

import { describe, it, expect } from "vitest";

describe("alerts module", () => {
  it("exports the expected functions", async () => {
    const mod = await import("@/lib/alerts");
    expect(typeof mod.checkHighRiskInvoices).toBe("function");
    expect(typeof mod.checkClientDeterioration).toBe("function");
    expect(typeof mod.checkCashFlowGap).toBe("function");
    expect(typeof mod.generatePredictiveAlertsForUser).toBe("function");
    expect(typeof mod.generatePredictiveAlertsForAll).toBe("function");
  });
});

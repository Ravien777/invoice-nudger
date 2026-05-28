import { describe, it, expect, vi } from "vitest";
import "@/lib/prisma";

vi.stubEnv("RESEND_API_KEY", "re_test_123");

describe("reconciliation module", () => {
  it("exports expected functions", async () => {
    const mod = await import("@/lib/reconciliation");
    expect(typeof mod.createPaymentRecord).toBe("function");
    expect(typeof mod.reconcileInvoice).toBe("function");
    expect(typeof mod.resolveDiscrepancy).toBe("function");
  });
});

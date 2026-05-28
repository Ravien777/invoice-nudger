import { describe, it, expect } from "vitest";

describe("forecast module", () => {
  it("exports computeForecast function", async () => {
    const mod = await import("@/lib/forecast");
    expect(typeof mod.computeForecast).toBe("function");
  });
});

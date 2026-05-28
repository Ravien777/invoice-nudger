import { describe, it, expect } from "vitest";
import { computeNextRunDate } from "@/lib/date-utils";

describe("computeNextRunDate", () => {
  it("returns weekly date 7 days from now", () => {
    const from = new Date("2025-01-01");
    const result = computeNextRunDate("weekly", undefined, from);
    expect(result.getTime()).toBe(new Date("2025-01-08").getTime());
  });

  it("returns biweekly date 14 days from now", () => {
    const from = new Date("2025-01-01");
    const result = computeNextRunDate("biweekly", undefined, from);
    expect(result.getTime()).toBe(new Date("2025-01-15").getTime());
  });

  it("returns monthly date with same day-of-month", () => {
    const from = new Date("2025-01-15");
    const result = computeNextRunDate("monthly", 15, from);
    const expected = new Date("2025-02-15");
    const diff = Math.abs(result.getTime() - expected.getTime());
    // Allow 24h tolerance for timezone effects
    expect(diff).toBeLessThanOrEqual(86400000);
  });

  it("clamps day-of-month to 28 for monthly", () => {
    // setDate clamps to 28 via Math.min(dayOfMonth ?? 1, 28)
    const from = new Date("2025-01-31");
    const result = computeNextRunDate("monthly", 31, from);
    expect(result.getUTCDate()).toBeLessThanOrEqual(28);
  });

  it("handles leap year", () => {
    const from = new Date("2024-01-15");
    const result = computeNextRunDate("monthly", 15, from);
    const expected = new Date("2024-02-15");
    const diff = Math.abs(result.getTime() - expected.getTime());
    expect(diff).toBeLessThanOrEqual(86400000);
  });

  it("returns quarterly date 90 days from now", () => {
    const from = new Date("2025-02-15");
    const result = computeNextRunDate("quarterly", 1, from);
    const expected = new Date("2025-05-16");
    const diff = Math.abs(result.getTime() - expected.getTime());
    expect(diff).toBeLessThanOrEqual(86400000);
  });

  it("returns annually date 1 year from now", () => {
    const from = new Date("2025-06-15");
    const result = computeNextRunDate("annually", 15, from);
    expect(result.getTime()).toBe(new Date("2026-06-15").getTime());
  });

  it("defaults to monthly with dayOfMonth=1", () => {
    const from = new Date("2025-03-15");
    const result = computeNextRunDate("monthly", undefined, from);
    const expected = new Date("2025-04-01");
    const diff = Math.abs(result.getTime() - expected.getTime());
    expect(diff).toBeLessThanOrEqual(86400000);
  });

  it("defaults from to today when not given", () => {
    const now = new Date();
    const result = computeNextRunDate("weekly");
    const expected = new Date(now.getTime() + 7 * 86400000);
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThanOrEqual(1000);
  });

  it("defaults to weekly for unknown frequency", () => {
    const from = new Date("2025-01-01");
    const result = computeNextRunDate("unknown", undefined, from);
    expect(result.getTime()).toBe(new Date("2025-01-08").getTime());
  });
});

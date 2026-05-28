import { describe, it, expect } from "vitest";
import { getTaxYearRange, currentTaxYear } from "@/lib/tax-utils";

describe("getTaxYearRange", () => {
  it("returns start/end for January fiscal start", () => {
    const { start, end } = getTaxYearRange(1, 2025);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(0);
    expect(end.getDate()).toBe(1);
  });

  it("returns start/end for July fiscal start", () => {
    const { start, end } = getTaxYearRange(7, 2025);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(1);
  });

  it("handles December fiscal start", () => {
    const { start, end } = getTaxYearRange(12, 2025);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(11);
  });
});

describe("currentTaxYear", () => {
  it("returns current year when month is past fiscal start", () => {
    const dt = new Date(2025, 5, 15); // June 15 local time
    expect(currentTaxYear(1, dt)).toBe(2025);
  });

  it("returns previous year when month is before fiscal start", () => {
    const dt = new Date(2025, 2, 15); // March 15 local time
    expect(currentTaxYear(7, dt)).toBe(2024);
  });

  it("returns current year on the boundary month", () => {
    const dt = new Date(2025, 6, 1); // July 1 local time
    expect(currentTaxYear(7, dt)).toBe(2025);
  });

  it("returns previous year the day before fiscal start", () => {
    const dt = new Date(2025, 5, 30); // June 30 local time
    expect(currentTaxYear(7, dt)).toBe(2024);
  });
});

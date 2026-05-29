import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";

async function callComputeCashflowForecast(userId = "user-1") {
  const { computeCashflowForecast } = await import("@/lib/cashflow");
  return computeCashflowForecast(userId);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeCashflowForecast", () => {
  it("returns 13 weeks with zero data", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const result = await callComputeCashflowForecast();
    expect(result.weeks).toHaveLength(13);
    expect(result.confidence).toBe("low");
    expect(result.totalExpectedIncome).toBe(0);
    expect(result.totalExpectedExpenses).toBe(0);
  });

  it("includes expected income from open invoices with payment probability", async () => {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 5);

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      { amount: 1000, paymentProbability: 0.8, dueDate },
    ] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const result = await callComputeCashflowForecast();
    expect(result.totalExpectedIncome).toBe(800);
    expect(result.weeks[0].expectedIncome).toBe(800);
  });

  it("includes recurring invoice amounts in the correct week", async () => {
    const today = new Date();
    const nextRun = new Date(today);
    nextRun.setDate(nextRun.getDate() + 10);

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([
      { amount: 500, nextRunDate: nextRun, clientName: "Client A" },
    ] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const result = await callComputeCashflowForecast();
    expect(result.totalExpectedIncome).toBe(500);
    const weekIndex = Math.floor(10 / 7);
    expect(result.weeks[weekIndex].expectedIncome).toBe(500);
  });

  it("projects expenses from average of last 3 months", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      { amount: 3000, date: ninetyDaysAgo },
    ] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const result = await callComputeCashflowForecast();
    const monthlyExpense = 3000 / 3;
    const weeklyExpense = monthlyExpense / 4.33;
    const expectedPerWeek = Math.round(weeklyExpense * 100) / 100;
    expect(result.totalExpectedExpenses).toBeGreaterThan(0);
    expect(result.weeks[0].expectedExpenses).toBe(expectedPerWeek);
  });

  it("returns high confidence with 6+ months data and 5+ clients", async () => {
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([
        { clientEmail: "a@test.com" },
        { clientEmail: "b@test.com" },
        { clientEmail: "c@test.com" },
        { clientEmail: "d@test.com" },
        { clientEmail: "e@test.com" },
      ] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(10);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      paidAt: new Date("2024-06-01"),
    } as any);

    const result = await callComputeCashflowForecast();
    expect(result.confidence).toBe("high");
  });

  it("returns medium confidence with 3-6 months data", async () => {
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ clientEmail: "a@test.com" }] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(1);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      paidAt: new Date("2025-03-01"),
    } as any);

    const result = await callComputeCashflowForecast();
    expect(result.confidence).toBe("medium");
  });

  it("returns low confidence with < 3 months data", async () => {
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ clientEmail: "a@test.com" }] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(1);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    } as any);

    const result = await callComputeCashflowForecast();
    expect(result.confidence).toBe("low");
  });

  it("computes cumulative balance across weeks", async () => {
    const today = new Date();
    const dueDate1 = new Date(today);
    dueDate1.setDate(dueDate1.getDate() + 2);
    const dueDate2 = new Date(today);
    dueDate2.setDate(dueDate2.getDate() + 9);

    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([
        { amount: 1000, paymentProbability: 1, dueDate: dueDate1 },
        { amount: 2000, paymentProbability: 1, dueDate: dueDate2 },
      ] as any)
      .mockResolvedValueOnce([] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const result = await callComputeCashflowForecast();
    const week0 = result.weeks[0];
    const week1 = result.weeks[1];
    expect(week0.cumulativeBalance).toBe(week0.netCashFlow);
    expect(week1.cumulativeBalance).toBe(
      Math.round((week0.netCashFlow + week1.netCashFlow) * 100) / 100,
    );
  });

  it("includes sixtyDayBalance and sixtyDayDate", async () => {
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const result = await callComputeCashflowForecast();
    expect(typeof result.sixtyDayBalance).toBe("number");
    expect(typeof result.sixtyDayDate).toBe("string");
    expect(result.sixtyDayDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("generates generatedAt timestamp", async () => {
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const result = await callComputeCashflowForecast();
    expect(typeof result.generatedAt).toBe("string");
    expect(() => new Date(result.generatedAt)).not.toThrow();
  });
});

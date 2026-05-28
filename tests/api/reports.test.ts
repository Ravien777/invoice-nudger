import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { GET as getTaxEstimate } from "@/app/api/reports/tax-estimate/route";
import { GET as getProfitLoss } from "@/app/api/reports/profit-loss/route";

vi.mock("@/lib/accountant-session");

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  vi.mocked(getOwnerIdForAccountant).mockReset();
  vi.mocked(getOwnerIdForAccountant).mockResolvedValue(null);
  const setup = await import("../setup");
  prisma = setup.prisma;
});

describe("GET /api/reports/tax-estimate", () => {
  it("returns 401 without auth", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = createNextRequest("http://localhost/api/reports/tax-estimate?year=2025");
    const res = await getTaxEstimate(req);
    expect(res.status).toBe(401);
  });

  it("returns tax estimate for given year", async () => {
    mockSession();
    mockUser({ id: "user-1" });
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 10000 } });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 3000 } });
    prisma.businessProfile.findUnique.mockResolvedValue({
      taxSavingsAmount: 2000,
    });

    const req = createNextRequest("http://localhost/api/reports/tax-estimate?year=2025");
    const res = await getTaxEstimate(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2025);
    expect(body.grossIncome).toBe(10000);
    expect(body.totalExpenses).toBe(3000);
    expect(body.taxableIncome).toBe(7000);
    expect(body.estimatedTax).toBe(2100);
    expect(body.taxRate).toBe(0.3);
    expect(body.taxSavingsAmount).toBe(2000);
  });

  it("returns currency from businessProfile", async () => {
    mockSession();
    mockUser({
      id: "user-1",
      businessProfile: {
        id: "bp-1",
        userId: "user-1",
        taxRate: 30,
        fiscalYearStart: 1,
        taxSavingsAmount: 0,
        baseCurrency: "EUR",
        defaultHourlyRate: null,
      },
    });
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.businessProfile.findUnique.mockResolvedValue({ taxSavingsAmount: 0 });

    const req = createNextRequest("http://localhost/api/reports/tax-estimate?year=2025");
    const res = await getTaxEstimate(req);
    const body = await res.json();
    expect(body.currency).toBe("EUR");
  });

  it("defaults currency to USD when no businessProfile", async () => {
    mockSession();
    mockUser({
      id: "user-1",
      businessProfile: null,
    } as any);
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.businessProfile.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/reports/tax-estimate?year=2025");
    const res = await getTaxEstimate(req);
    const body = await res.json();
    expect(body.currency).toBe("USD");
  });

  it("defaults to current tax year when no year param", async () => {
    mockSession();
    mockUser({ id: "user-1" });
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.businessProfile.findUnique.mockResolvedValue({ taxSavingsAmount: 0 });

    const req = createNextRequest("http://localhost/api/reports/tax-estimate");
    const res = await getTaxEstimate(req);
    const body = await res.json();
    expect(body.year).toBeGreaterThanOrEqual(2025);
  });

  it("handles accountant scope", async () => {
    mockSession("accountant@test.com");
    vi.mocked(getOwnerIdForAccountant).mockResolvedValue("owner-1");
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "owner-1", email: "owner@test.com", name: "Owner", businessProfile: { id: "bp-1", userId: "owner-1", taxRate: 30, fiscalYearStart: 1, taxSavingsAmount: 0, baseCurrency: "USD", defaultHourlyRate: null } })
      .mockResolvedValueOnce({ id: "owner-1", email: "owner@test.com", name: "Owner", businessProfile: { id: "bp-1", userId: "owner-1", taxRate: 30, fiscalYearStart: 1, taxSavingsAmount: 0, baseCurrency: "USD", defaultHourlyRate: null } } as any);
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    prisma.businessProfile.findUnique.mockResolvedValue({ taxSavingsAmount: 0 });

    const req = createNextRequest("http://localhost/api/reports/tax-estimate?year=2025");
    const res = await getTaxEstimate(req);
    expect(res.status).toBe(200);
  });

  it("returns 404 for missing user", async () => {
    mockSession("missing@test.com");
    prisma.user.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/reports/tax-estimate?year=2025");
    const res = await getTaxEstimate(req);
    expect(res.status).toBe(404);
  });

  it("returns taxSavingsAmount 0 when no businessProfile record", async () => {
    mockSession();
    mockUser({
      id: "user-1",
      businessProfile: { id: "bp-1", userId: "user-1", taxRate: 30, fiscalYearStart: 1, taxSavingsAmount: 500, baseCurrency: "USD", defaultHourlyRate: null },
    });
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.businessProfile.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/reports/tax-estimate?year=2025");
    const res = await getTaxEstimate(req);
    const body = await res.json();
    expect(body.taxSavingsAmount).toBe(0);
  });
});

describe("GET /api/reports/profit-loss", () => {
  it("returns 401 without auth", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = createNextRequest("http://localhost/api/reports/profit-loss?year=2025");
    const res = await getProfitLoss(req);
    expect(res.status).toBe(401);
  });

  it("returns P&L for given tax year", async () => {
    mockSession();
    mockUser({ id: "user-1" });
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv-1", amount: 5000, paidAt: new Date("2025-03-15") },
      { id: "inv-2", amount: 3000, paidAt: new Date("2025-07-01") },
    ]);
    prisma.expense.findMany.mockResolvedValue([
      { id: "exp-1", amount: 1000, date: new Date("2025-04-01"), taxDeductible: true, category: { name: "Supplies" } },
      { id: "exp-2", amount: 500, date: new Date("2025-05-01"), taxDeductible: false, category: { name: "Meals" } },
    ]);

    const req = createNextRequest("http://localhost/api/reports/profit-loss?year=2025");
    const res = await getProfitLoss(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2025);
    expect(body.income).toHaveLength(2);
    expect(body.expenses).toHaveLength(2);
    expect(body.summary.totalIncome).toBe(8000);
    expect(body.summary.totalExpenses).toBe(1500);
    expect(body.summary.netProfit).toBe(6500);
    expect(body.summary.estimatedTax).toBe(1950);
    expect(body.summary.taxRate).toBe(0.3);
  });

  it("filters by month when month param is provided", async () => {
    mockSession();
    mockUser({ id: "user-1" });
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv-1", amount: 2000, paidAt: new Date("2025-03-10") },
    ]);
    prisma.expense.findMany.mockResolvedValue([
      { id: "exp-1", amount: 300, date: new Date("2025-03-15"), taxDeductible: true, category: { name: "Supplies" } },
    ]);

    const req = createNextRequest("http://localhost/api/reports/profit-loss?year=2025&month=2025-03");
    const res = await getProfitLoss(req);
    const body = await res.json();
    expect(body.income).toHaveLength(1);
    expect(body.income[0].month).toBe("2025-03");
    expect(body.expenses).toHaveLength(1);
    expect(body.summary.totalIncome).toBe(2000);
    expect(body.summary.totalExpenses).toBe(300);
  });

  it("month filter outside range returns no results", async () => {
    mockSession();
    mockUser({ id: "user-1" });
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.expense.findMany.mockResolvedValue([]);

    const req = createNextRequest("http://localhost/api/reports/profit-loss?year=2025&month=2025-12");
    const res = await getProfitLoss(req);
    const body = await res.json();
    expect(body.income).toHaveLength(0);
    expect(body.expenses).toHaveLength(0);
    expect(body.summary.totalIncome).toBe(0);
  });

  it("handles accountant scope", async () => {
    mockSession("accountant@test.com");
    vi.mocked(getOwnerIdForAccountant).mockResolvedValue("owner-1");
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "owner-1", email: "owner@test.com", name: "Owner", businessProfile: { id: "bp-1", userId: "owner-1", taxRate: 30, fiscalYearStart: 1, taxSavingsAmount: 0, baseCurrency: "USD", defaultHourlyRate: null } })
      .mockResolvedValueOnce({ id: "owner-1", email: "owner@test.com", name: "Owner", businessProfile: { id: "bp-1", userId: "owner-1", taxRate: 30, fiscalYearStart: 1, taxSavingsAmount: 0, baseCurrency: "USD", defaultHourlyRate: null } } as any);
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.expense.findMany.mockResolvedValue([]);

    const req = createNextRequest("http://localhost/api/reports/profit-loss?year=2025");
    const res = await getProfitLoss(req);
    expect(res.status).toBe(200);
  });

  it("returns 404 for missing user", async () => {
    mockSession("missing@test.com");
    prisma.user.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/reports/profit-loss?year=2025");
    const res = await getProfitLoss(req);
    expect(res.status).toBe(404);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";
import { calculatePayYourselfAmount } from "@/lib/pay-yourself";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("calculatePayYourselfAmount", () => {
  it("returns 0 when no paid invoices", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: null,
      taxRate: 30,
    } as any);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
    const result = await calculatePayYourselfAmount("user-1");
    expect(result.available).toBe(0);
    expect(result.recommended).toBe(0);
  });

  it("calculates 40% of paid invoices since last date", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: new Date("2025-01-01"),
      taxRate: 30,
    } as any);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { amount: 2000 },
      { amount: 3000 },
    ] as any);
    const result = await calculatePayYourselfAmount("user-1");
    expect(result.available).toBe(2000);
    expect(result.recommended).toBe(2000);
  });

  it("uses gt filter when lastPayYourselfDate is set", async () => {
    const lastDate = new Date("2025-06-01");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: lastDate,
      taxRate: 30,
    } as any);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([{ amount: 1000 }] as any);
    const result = await calculatePayYourselfAmount("user-1");
    expect(result.available).toBe(400);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: { gt: lastDate },
        }),
      }),
    );
  });

  it("uses { not: null } filter when no lastPayYourselfDate", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: null,
      taxRate: 30,
    } as any);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([{ amount: 500 }] as any);
    await calculatePayYourselfAmount("user-1");
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: { not: null },
        }),
      }),
    );
  });

  it("returns user not found with zeros", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const result = await calculatePayYourselfAmount("nonexistent");
    expect(result.available).toBe(0);
    expect(result.lastPaymentDate).toBeNull();
  });

  it("returns lastPaymentDate from user", async () => {
    const lastDate = new Date("2025-01-01");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: lastDate,
      taxRate: 30,
    } as any);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as any);
    const result = await calculatePayYourselfAmount("user-1");
    expect(result.lastPaymentDate).toEqual(lastDate);
  });
});

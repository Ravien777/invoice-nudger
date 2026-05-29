import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";
import { calculatePayYourselfAmount } from "@/lib/pay-yourself";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("calculatePayYourselfAmount", () => {
  it("returns 0 when no allocation records", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: null,
      taxRate: 30,
    } as any);
    vi.mocked(prisma.allocationRecord.findMany).mockResolvedValue([]);
    const result = await calculatePayYourselfAmount("user-1");
    expect(result.available).toBe(0);
    expect(result.recommended).toBe(0);
  });

  it("sums ownerPayAmount from allocation records since last date", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: new Date("2025-01-01"),
      taxRate: 30,
    } as any);
    vi.mocked(prisma.allocationRecord.findMany).mockResolvedValue([
      { ownerPayAmount: 800 },
      { ownerPayAmount: 1200 },
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
    vi.mocked(prisma.allocationRecord.findMany).mockResolvedValue([{ ownerPayAmount: 400 }] as any);
    const result = await calculatePayYourselfAmount("user-1");
    expect(result.available).toBe(400);
    expect(prisma.allocationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gt: lastDate },
        }),
      }),
    );
  });

  it("omits createdAt filter when no lastPayYourselfDate", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      lastPayYourselfDate: null,
      taxRate: 30,
    } as any);
    vi.mocked(prisma.allocationRecord.findMany).mockResolvedValue([{ ownerPayAmount: 200 }] as any);
    await calculatePayYourselfAmount("user-1");
    expect(prisma.allocationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
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
    vi.mocked(prisma.allocationRecord.findMany).mockResolvedValue([] as any);
    const result = await calculatePayYourselfAmount("user-1");
    expect(result.lastPaymentDate).toEqual(lastDate);
  });
});

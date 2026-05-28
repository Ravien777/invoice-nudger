import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";
import { createAllocationRecord } from "@/lib/allocation";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAllocationRecord", () => {
  it("creates record with correct split using profile percentages", async () => {
    vi.mocked(prisma.allocationProfile.findUnique).mockResolvedValue({
      id: "ap-1",
      userId: "user-1",
      taxPercent: 20,
      operatingPercent: 30,
      profitPercent: 10,
      ownerPayPercent: 40,
      currency: "USD",
      updatedAt: new Date(),
    } as any);

    const createdRecord = {
      id: "ar-1",
      userId: "user-1",
      totalReceived: 1000,
      taxAmount: 200,
      operatingAmount: 300,
      profitAmount: 100,
      ownerPayAmount: 400,
      currency: "USD",
      invoiceId: "inv-1",
      note: null,
      createdAt: new Date(),
    };
    vi.mocked(prisma.allocationRecord.create).mockResolvedValue(createdRecord as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    const result = await createAllocationRecord("user-1", 1000, "USD", "inv-1");

    expect(prisma.allocationProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prisma.allocationRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          totalReceived: 1000,
          taxAmount: 200,
          operatingAmount: 300,
          profitAmount: 100,
          ownerPayAmount: 400,
          currency: "USD",
          invoiceId: "inv-1",
        }),
      }),
    );
    expect(result.taxAmount).toBe(200);
    expect(result.ownerPayAmount).toBe(400);
  });

  it("uses default percentages when no profile exists", async () => {
    vi.mocked(prisma.allocationProfile.findUnique).mockResolvedValue(null);

    const createdRecord = {
      id: "ar-2",
      userId: "user-1",
      totalReceived: 1000,
      taxAmount: 250,
      operatingAmount: 300,
      profitAmount: 50,
      ownerPayAmount: 400,
      currency: "USD",
      invoiceId: null,
      note: null,
      createdAt: new Date(),
    };
    vi.mocked(prisma.allocationRecord.create).mockResolvedValue(createdRecord as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    const result = await createAllocationRecord("user-1", 1000, "USD");

    expect(result.taxAmount).toBe(250);
    expect(result.operatingAmount).toBe(300);
    expect(result.profitAmount).toBe(50);
    expect(result.ownerPayAmount).toBe(400);
  });

  it("creates an in-app notification", async () => {
    vi.mocked(prisma.allocationProfile.findUnique).mockResolvedValue({
      id: "ap-1",
      userId: "user-1",
      taxPercent: 25,
      operatingPercent: 30,
      profitPercent: 5,
      ownerPayPercent: 40,
      currency: "USD",
      updatedAt: new Date(),
    } as any);

    vi.mocked(prisma.allocationRecord.create).mockResolvedValue({
      id: "ar-3",
      userId: "user-1",
      totalReceived: 500,
      taxAmount: 125,
      operatingAmount: 150,
      profitAmount: 25,
      ownerPayAmount: 200,
      currency: "USD",
      invoiceId: null,
      note: null,
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    await createAllocationRecord("user-1", 500, "USD");

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          type: "allocation",
          title: "Income Allocated",
        }),
      }),
    );
  });

  it("handles zero amount gracefully", async () => {
    vi.mocked(prisma.allocationProfile.findUnique).mockResolvedValue(null);

    const createdRecord = {
      id: "ar-4",
      userId: "user-1",
      totalReceived: 0,
      taxAmount: 0,
      operatingAmount: 0,
      profitAmount: 0,
      ownerPayAmount: 0,
      currency: "USD",
      invoiceId: null,
      note: null,
      createdAt: new Date(),
    };
    vi.mocked(prisma.allocationRecord.create).mockResolvedValue(createdRecord as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    const result = await createAllocationRecord("user-1", 0, "USD");

    expect(result.totalReceived).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.operatingAmount).toBe(0);
    expect(result.profitAmount).toBe(0);
    expect(result.ownerPayAmount).toBe(0);
  });
});

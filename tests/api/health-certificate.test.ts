import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

async function callHandler() {
  const { GET } = await import("@/app/api/reports/health-certificate/route");
  return GET();
}

describe("GET /api/reports/health-certificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "test@example.com" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const response = await callHandler();
    expect(response.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const response = await callHandler();
    expect(response.status).toBe(404);
  });

  it("returns 403 for non-agency users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      plan: "free",
      businessProfile: null,
    } as any);
    const response = await callHandler();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Agency");
  });

  it("returns PDF certificate for agency users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test Agency",
      plan: "agency",
      businessProfile: { name: "Test Agency Ltd" },
    } as any);

    vi.mocked(prisma.invoice.count).mockResolvedValue(10);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { amount: 1000, paidAt: new Date(), dueDate: new Date() },
      { amount: 2000, paidAt: new Date(), dueDate: new Date() },
    ] as any);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({
      _sum: { amount: 500 },
    } as any);
    vi.mocked(prisma.clientPaymentProfile.findMany).mockResolvedValue([
      { avgDaysLate: 15 },
    ] as any);
    vi.mocked(prisma.allocationProfile.findUnique).mockResolvedValue({
      taxPercent: 25,
    } as any);
    vi.mocked(prisma.allocationRecord.count).mockResolvedValue(3);
    vi.mocked(prisma.invoice.aggregate).mockResolvedValue({
      _sum: { amount: 5000 },
    } as any);

    const response = await callHandler();
    expect(response.status).toBe(200);
    const contentType = response.headers.get("Content-Type");
    expect(contentType).toContain("application/pdf");
    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("health-certificate");
  });
});

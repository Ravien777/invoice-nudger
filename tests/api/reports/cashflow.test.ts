import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../setup";
import { getServerSession } from "next-auth";

async function callHandler() {
  const { GET } = await import("@/app/api/reports/cashflow/route");
  return GET();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "test@example.com" },
  } as any);
});

describe("GET /api/reports/cashflow", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const response = await callHandler();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const response = await callHandler();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("User not found");
  });

  it("returns 402 for free plan", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      plan: "free",
    } as any);
    const response = await callHandler();
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error).toContain("Upgrade to Pro");
  });

  it("returns 402 for basic plan", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      plan: "basic",
    } as any);
    const response = await callHandler();
    expect(response.status).toBe(402);
  });

  it("returns forecast data for pro plan", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      plan: "pro",
    } as any);
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([]);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const response = await callHandler();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("weeks");
    expect(body).toHaveProperty("confidence");
    expect(body).toHaveProperty("sixtyDayBalance");
    expect(Array.isArray(body.weeks)).toBe(true);
  });

  it("returns forecast data for agency plan", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      email: "agency@example.com",
      name: "Agency",
      plan: "agency",
    } as any);
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([]);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const response = await callHandler();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("weeks");
  });

  it("includes Cache-Control header on success", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      plan: "pro",
    } as any);
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(prisma.recurringInvoice.findMany).mockResolvedValue([]);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

    const response = await callHandler();
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });
});

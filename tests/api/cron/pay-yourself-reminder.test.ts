import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../../setup";

function createCronRequest(authToken?: string) {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers["authorization"] = `Bearer ${authToken}`;
  }
  return new Request("http://localhost/api/cron/pay-yourself-reminder", {
    method: "GET",
    headers,
  });
}

async function callHandler(req: Request) {
  const { GET } = await import("@/app/api/cron/pay-yourself-reminder/route");
  return GET(req);
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("GET /api/cron/pay-yourself-reminder", () => {
  it("returns 401 when no auth header provided", async () => {
    const req = createCronRequest();
    const response = await callHandler(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when wrong auth token provided", async () => {
    const req = createCronRequest("wrong-token");
    const response = await callHandler(req);
    expect(response.status).toBe(401);
  });

  it("processes users and creates notifications for those with available amount", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-1", name: "User 1", businessProfile: { baseCurrency: "USD" } },
      { id: "user-2", name: "User 2", businessProfile: { baseCurrency: "USD" } },
    ] as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "User 1",
      lastPayYourselfDate: thirtyDaysAgo,
      taxRate: 30,
    } as any);

    vi.mocked(prisma.allocationRecord.findMany)
      .mockResolvedValueOnce([{ ownerPayAmount: 500 }] as any)
      .mockResolvedValueOnce([]);

    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    const req = createCronRequest("test-cron-secret");
    const response = await callHandler(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.processed).toBe(2);
    expect(body.notified).toBe(1);

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          type: "pay_yourself",
        }),
      }),
    );
  });

  it("does not create notification when available amount is 0", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-1", name: "User 1", businessProfile: { baseCurrency: "USD" } },
    ] as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "User 1",
      lastPayYourselfDate: null,
      taxRate: 30,
    } as any);

    vi.mocked(prisma.allocationRecord.findMany).mockResolvedValue([]);

    const req = createCronRequest("test-cron-secret");
    const response = await callHandler(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.processed).toBe(1);
    expect(body.notified).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("skips auth check when CRON_SECRET is 'skip'", async () => {
    process.env.CRON_SECRET = "skip";

    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const req = createCronRequest();
    const response = await callHandler(req);
    expect(response.status).toBe(200);
  });

  it("handles errors gracefully per user", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-1", name: "User 1", businessProfile: { baseCurrency: "USD" } },
      { id: "user-2", name: "User 2", businessProfile: { baseCurrency: "USD" } },
    ] as any);

    vi.mocked(prisma.user.findUnique).mockImplementation(() => {
      throw new Error("DB error");
    });

    const req = createCronRequest("test-cron-secret");
    const response = await callHandler(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.processed).toBe(2);
    expect(body.notified).toBe(0);
    expect(body.results[0].available).toBe(0);
    expect(body.results[0].notified).toBe(false);
  });
});

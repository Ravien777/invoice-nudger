import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { GET as ListGET, POST as CreatePOST } from "@/app/api/recurring/route";

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

function mockRecurring(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    userId: "user-1",
    clientName: "Acme Corp",
    clientEmail: "billing@acme.com",
    clientPhone: null,
    amount: 1000,
    currency: "USD",
    frequency: "monthly",
    dayOfMonth: 1,
    nextRunDate: new Date("2025-07-01"),
    endDate: null,
    description: "Monthly retainer",
    status: "active",
    autoSend: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("GET /api/recurring", () => {
  it("returns 401 without session", async () => {
    const res = await ListGET();
    expect(res.status).toBe(401);
  });

  it("returns user's recurring invoices", async () => {
    mockSession();
    mockUser();
    prisma.recurringInvoice.findMany.mockResolvedValue([mockRecurring()]);

    const res = await ListGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/recurring", () => {
  it("returns 401 without session", async () => {
    const res = await CreatePOST(createNextRequest("http://localhost/api/recurring", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("creates recurring invoice", async () => {
    mockSession();
    mockUser();
    prisma.recurringInvoice.create.mockResolvedValue(mockRecurring());

    const res = await CreatePOST(createNextRequest("http://localhost/api/recurring", {
      method: "POST",
      body: {
        clientName: "Acme Corp",
        clientEmail: "billing@acme.com",
        amount: 1000,
        frequency: "monthly",
        dayOfMonth: 1,
        nextRunDate: "2025-07-01",
        autoSend: true,
      },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.clientName).toBe("Acme Corp");
  });

  it("returns 400 for invalid body", async () => {
    mockSession();
    mockUser();
    const res = await CreatePOST(createNextRequest("http://localhost/api/recurring", {
      method: "POST",
      body: { frequency: "invalid" },
    }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for accountant session", async () => {
    vi.mocked(getOwnerIdForAccountant).mockResolvedValue("owner-1");
    mockSession("accountant@example.com");
    mockUser({ id: "owner-1" });

    const res = await CreatePOST(createNextRequest("http://localhost/api/recurring", {
      method: "POST",
      body: { clientName: "Test", clientEmail: "t@t.com", amount: 100, frequency: "monthly", nextRunDate: "2025-07-01", autoSend: true },
    }));
    expect(res.status).toBe(403);
  });
});

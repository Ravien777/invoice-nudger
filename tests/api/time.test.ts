import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { getTeamContext } from "@/lib/team-session";
import { mockSession, mockUser, createNextRequest } from "../helpers";

vi.mock("@/lib/team-session", () => ({
  getTeamContext: vi.fn(),
}));
import { GET as ListGET, POST as CreatePOST } from "@/app/api/time/route";
import { GET as ItemGET, PUT as ItemPUT, DELETE as ItemDELETE } from "@/app/api/time/[id]/route";
import { POST as StopPOST } from "@/app/api/time/[id]/stop/route";
import { POST as CreateInvoicePOST } from "@/app/api/time/create-invoice/route";

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  vi.mocked(getTeamContext).mockResolvedValue(null);
  const setup = await import("../setup");
  prisma = setup.prisma;
});

function mockEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    userId: "user-1",
    clientEmail: "client@example.com",
    clientName: "Acme Corp",
    description: "Website redesign",
    startTime: new Date("2025-06-01T10:00:00Z"),
    endTime: new Date("2025-06-01T12:30:00Z"),
    durationMinutes: 150,
    hourlyRate: 100,
    invoiced: false,
    invoiceId: null,
    createdAt: new Date("2025-06-01"),
    ...overrides,
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/time", () => {
  it("returns 401 without session", async () => {
    const res = await ListGET(createNextRequest("http://localhost/api/time"));
    expect(res.status).toBe(401);
  });

  it("returns user's time entries", async () => {
    mockSession();
    mockUser({ businessProfile: { defaultHourlyRate: 100 } });
    prisma.timeEntry.findMany.mockResolvedValue([mockEntry()]);
    prisma.timeEntry.count.mockResolvedValue(1);

    const res = await ListGET(createNextRequest("http://localhost/api/time"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.entries[0].durationLabel).toBe("2 h 30 min");
    expect(body.defaultHourlyRate).toBe(100);
  });

  it("filters by clientEmail", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findMany.mockResolvedValue([mockEntry()]);
    prisma.timeEntry.count.mockResolvedValue(1);

    const req = createNextRequest("http://localhost/api/time?clientEmail=client@example.com");
    await ListGET(req);
    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientEmail: "client@example.com" }),
      }),
    );
  });

  it("filters by invoiced=false", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findMany.mockResolvedValue([mockEntry()]);
    prisma.timeEntry.count.mockResolvedValue(1);

    const req = createNextRequest("http://localhost/api/time?invoiced=false");
    await ListGET(req);
    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ invoiced: false }),
      }),
    );
  });
});

describe("POST /api/time (start timer)", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/time", {
      method: "POST",
      body: { clientEmail: "client@example.com" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(401);
  });

  it("starts a timer", async () => {
    mockSession();
    mockUser();
    const created = mockEntry({ endTime: null, durationMinutes: null });
    prisma.timeEntry.create.mockResolvedValue(created);

    const req = createNextRequest("http://localhost/api/time", {
      method: "POST",
      body: {
        clientEmail: "client@example.com",
        clientName: "Acme Corp",
        description: "Website redesign",
        hourlyRate: 100,
      },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entry.clientEmail).toBe("client@example.com");
    expect(prisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientEmail: "client@example.com",
          userId: "user-1",
        }),
      }),
    );
  });

  it("returns 400 for missing clientEmail", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/time", {
      method: "POST",
      body: { description: "No email" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/time/[id]/stop", () => {
  it("stops a running timer", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(
      mockEntry({ endTime: null, durationMinutes: null }),
    );
    const stopped = mockEntry({ endTime: new Date(), durationMinutes: 150 });
    prisma.timeEntry.update.mockResolvedValue(stopped);

    const res = await StopPOST(createNextRequest("http://localhost/api/time/entry-1/stop"), params("entry-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entry.durationMinutes).toBe(150);
  });

  it("returns 400 for already stopped timer", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(mockEntry({ endTime: new Date() }));

    const res = await StopPOST(createNextRequest("http://localhost/api/time/entry-1/stop"), params("entry-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for other user's entry", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(null);

    const res = await StopPOST(createNextRequest("http://localhost/api/time/nonexistent/stop"), params("nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/time/[id]", () => {
  it("returns a single entry", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(mockEntry());

    const res = await ItemGET(createNextRequest("http://localhost/api/time/entry-1"), params("entry-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entry.id).toBe("entry-1");
  });

  it("returns 404 for other user's entry", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(null);

    const res = await ItemGET(createNextRequest("http://localhost/api/time/nonexistent"), params("nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/time/[id]", () => {
  it("updates an entry", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(mockEntry());
    const updated = mockEntry({ description: "Updated description" });
    prisma.timeEntry.update.mockResolvedValue(updated);

    const req = createNextRequest("http://localhost/api/time/entry-1", {
      method: "PUT",
      body: { description: "Updated description" },
    });
    const res = await ItemPUT(req, params("entry-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entry.description).toBe("Updated description");
  });

  it("rejects update for invoiced entry", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(mockEntry({ invoiced: true }));

    const req = createNextRequest("http://localhost/api/time/entry-1", {
      method: "PUT",
      body: { description: "Nope" },
    });
    const res = await ItemPUT(req, params("entry-1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/time/[id]", () => {
  it("deletes an entry", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(mockEntry());
    prisma.timeEntry.delete.mockResolvedValue({} as any);

    const res = await ItemDELETE(createNextRequest("http://localhost/api/time/entry-1", { method: "DELETE" }), params("entry-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("rejects delete for invoiced entry", async () => {
    mockSession();
    mockUser();
    prisma.timeEntry.findFirst.mockResolvedValue(mockEntry({ invoiced: true }));

    const res = await ItemDELETE(createNextRequest("http://localhost/api/time/entry-1", { method: "DELETE" }), params("entry-1"));
    expect(res.status).toBe(400);
  });

  it("allows team member with member role to delete", async () => {
    mockSession();
    mockUser();
    vi.mocked(getTeamContext).mockResolvedValue({ ownerId: "owner-1", role: "member" });
    prisma.timeEntry.findFirst.mockResolvedValue(mockEntry({ userId: "owner-1" }));
    prisma.timeEntry.delete.mockResolvedValue({} as any);

    const res = await ItemDELETE(createNextRequest("http://localhost/api/time/entry-1", { method: "DELETE" }), params("entry-1"));
    expect(res.status).toBe(200);
    expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "owner-1" }) }),
    );
  });

  it("blocks team member with viewer role from deleting", async () => {
    mockSession();
    mockUser();
    vi.mocked(getTeamContext).mockResolvedValue({ ownerId: "owner-1", role: "viewer" });

    const res = await ItemDELETE(createNextRequest("http://localhost/api/time/entry-1", { method: "DELETE" }), params("entry-1"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/time/create-invoice", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/time/create-invoice", {
      method: "POST",
      body: { clientEmail: "client@example.com", hourlyRate: 100 },
    });
    const res = await CreateInvoicePOST(req);
    expect(res.status).toBe(401);
  });

  it("creates invoice from time entries", async () => {
    mockSession();
    mockUser({ businessProfile: { defaultHourlyRate: 100, baseCurrency: "USD" } });
    prisma.timeEntry.findMany.mockResolvedValue([
      mockEntry({ id: "e1", durationMinutes: 120 }),
      mockEntry({ id: "e2", durationMinutes: 60 }),
    ]);
    prisma.invoice.create.mockResolvedValue({
      id: "inv-1",
      clientName: "Acme Corp",
      clientEmail: "client@example.com",
      amount: 300,
      currency: "USD",
      dueDate: new Date(),
      status: "unpaid",
    } as any);
    prisma.timeEntry.updateMany.mockResolvedValue({ count: 2 } as any);

    const req = createNextRequest("http://localhost/api/time/create-invoice", {
      method: "POST",
      body: { clientEmail: "client@example.com", hourlyRate: 100 },
    });
    const res = await CreateInvoicePOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invoice.amount).toBe(300);
    expect(body.invoice.clientName).toBe("Acme Corp");
  });

  it("returns 400 if no unbilled entries exist", async () => {
    mockSession();
    mockUser({ businessProfile: { defaultHourlyRate: 100 } });
    prisma.timeEntry.findMany.mockResolvedValue([]);

    const req = createNextRequest("http://localhost/api/time/create-invoice", {
      method: "POST",
      body: { clientEmail: "client@example.com", hourlyRate: 100 },
    });
    const res = await CreateInvoicePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 if no hourly rate set", async () => {
    mockSession();
    mockUser({ businessProfile: { defaultHourlyRate: null } });
    prisma.timeEntry.findMany.mockResolvedValue([mockEntry()]);

    const req = createNextRequest("http://localhost/api/time/create-invoice", {
      method: "POST",
      body: { clientEmail: "client@example.com" },
    });
    const res = await CreateInvoicePOST(req);
    expect(res.status).toBe(400);
  });
});

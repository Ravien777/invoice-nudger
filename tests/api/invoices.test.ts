import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { canCreateInvoice } from "@/lib/subscriptions";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { GET as ListGET, POST as CreatePOST } from "@/app/api/invoices/route";
import { GET as ItemGET, PUT as ItemPUT, DELETE as ItemDELETE } from "@/app/api/invoices/[id]/route";
import { POST as MarkPaidPOST } from "@/app/api/invoices/[id]/mark-paid/route";

vi.mock("@/lib/reconciliation");
vi.mock("@/lib/allocation");
vi.mock("@/lib/accountant-session");
vi.mock("@/lib/subscriptions");

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  vi.mocked(getOwnerIdForAccountant).mockReset();
  vi.mocked(getOwnerIdForAccountant).mockResolvedValue(null);
  vi.mocked(canCreateInvoice).mockResolvedValue({ allowed: true, current: 0, limit: 50, tier: "pro" });
  const setup = await import("../setup");
  prisma = setup.prisma;
  prisma.plazaosClient.findFirst.mockResolvedValue(null);
  prisma.plazaosClient.findUnique.mockResolvedValue(null);
});

function mockInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    userId: "user-1",
    clientName: "Acme Corp",
    clientEmail: "billing@acme.com",
    clientPhone: null,
    projectName: "Website redesign",
    amount: 2500,
    currency: "USD",
    dueDate: new Date("2025-07-01"),
    status: "unpaid",
    notes: null,
    invoiceNumber: "INV-001",
    reminderScheduleId: null,
    paymentLink: null,
    paidAt: null,
    source: null,
    externalId: null,
    externalContactId: null,
    lastSyncedAt: null,
    reconciliationStatus: null,
    lastReconciledAt: null,
    promisedDate: null,
    promiseDetectedAt: null,
    promiseStatus: "none",
    promiseConfidence: null,
    lateFeeEnabled: true,
    lateFeeAmount: 10,
    interestRate: 0,
    feeCap: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    reminders: [],
    payments: [],
    promiseEvents: [],
    ...overrides,
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/invoices (list)", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/invoices");
    const res = await ListGET(req);
    expect(res.status).toBe(401);
  });

  it("returns user's invoices", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findMany.mockResolvedValue([mockInvoice()]);

    const req = createNextRequest("http://localhost/api/invoices");
    const res = await ListGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("filters by status query param", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findMany.mockResolvedValue([]);

    const req = createNextRequest("http://localhost/api/invoices?status=paid");
    await ListGET(req);
    const where = prisma.invoice.findMany.mock.calls[0][0]?.where;
    expect(where.status).toBe("paid");
  });
});

describe("POST /api/invoices (create)", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/invoices", {
      method: "POST",
      body: { clientName: "Test", clientEmail: "t@t.com", amount: 100, dueDate: "2025-07-01" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(401);
  });

  it("creates invoice with valid data", async () => {
    mockSession();
    mockUser();
    const created = mockInvoice();
    prisma.invoice.create.mockResolvedValue(created);

    const req = createNextRequest("http://localhost/api/invoices", {
      method: "POST",
      body: { clientName: "Acme Corp", clientEmail: "billing@acme.com", amount: 2500, dueDate: "2025-07-01" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.clientName).toBe("Acme Corp");
    expect(body.amount).toBe(2500);
  });

  it("returns 402 when invoice limit reached", async () => {
    vi.mocked(canCreateInvoice).mockResolvedValue({ allowed: false, current: 50, limit: 50, tier: "pro" });
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/invoices", {
      method: "POST",
      body: { clientName: "Acme Corp", clientEmail: "billing@acme.com", amount: 2500, dueDate: "2025-07-01" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(402);
  });

  it("returns 400 for invalid body", async () => {
    mockSession();
    mockUser();
    const req = createNextRequest("http://localhost/api/invoices", {
      method: "POST",
      body: { amount: "not-a-number" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 for accountant session", async () => {
    vi.mocked(getOwnerIdForAccountant).mockResolvedValue("owner-1");
    mockSession("accountant@example.com");
    mockUser({ id: "owner-1" });

    const req = createNextRequest("http://localhost/api/invoices", {
      method: "POST",
      body: { clientName: "Test", clientEmail: "t@t.com", amount: 100, dueDate: "2025-07-01" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/invoices/[id]", () => {
  it("returns invoice by id", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice());

    const res = await ItemGET(createNextRequest("http://localhost/api/invoices/inv-1"), params("inv-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("inv-1");
  });

  it("returns 403 for other user's invoice", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ userId: "other-user" }));

    const res = await ItemGET(createNextRequest("http://localhost/api/invoices/inv-1"), params("inv-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when invoice does not exist", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(null);

    const res = await ItemGET(createNextRequest("http://localhost/api/invoices/nonexistent"), params("nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/invoices/[id]", () => {
  it("updates invoice", async () => {
    mockSession();
    mockUser();
    const updated = mockInvoice({ clientName: "Updated Corp" });
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
    prisma.invoice.update.mockResolvedValue(updated);

    const req = createNextRequest("http://localhost/api/invoices/inv-1", {
      method: "PUT",
      body: { clientName: "Updated Corp", clientEmail: "billing@acme.com", amount: 2500, dueDate: "2025-07-01" },
    });
    const res = await ItemPUT(req, params("inv-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientName).toBe("Updated Corp");
  });

  it("returns 404 for nonexistent invoice", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/invoices/inv-99", {
      method: "PUT",
      body: { clientName: "Nope", clientEmail: "x@x.com", amount: 100, dueDate: "2025-07-01" },
    });
    const res = await ItemPUT(req, params("inv-99"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/invoices/[id]", () => {
  it("deletes invoice", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
    prisma.reminderLog.deleteMany.mockResolvedValue({ count: 0 });
    prisma.invoice.delete.mockResolvedValue(mockInvoice());

    const res = await ItemDELETE(createNextRequest("http://localhost/api/invoices/inv-1", { method: "DELETE" }), params("inv-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 for nonexistent invoice", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(null);

    const res = await ItemDELETE(createNextRequest("http://localhost/api/invoices/inv-99", { method: "DELETE" }), params("inv-99"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/invoices/[id]/mark-paid", () => {
  it("marks invoice as paid", async () => {
    mockSession();
    mockUser();
    const invoice = mockInvoice();
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    prisma.invoice.update.mockResolvedValue({ ...invoice, status: "paid", paidAt: new Date() });
    prisma.reminderLog.create.mockResolvedValue({});

    const res = await MarkPaidPOST(createNextRequest("http://localhost/api/invoices/inv-1/mark-paid", { method: "POST" }), params("inv-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("paid");
  });

  it("returns 400 for already-paid invoice", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: "paid" }));

    const res = await MarkPaidPOST(createNextRequest("http://localhost/api/invoices/inv-1/mark-paid", { method: "POST" }), params("inv-1"));
    expect(res.status).toBe(400);
  });

  it("returns 403 for other user's invoice", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ userId: "other-user" }));

    const res = await MarkPaidPOST(createNextRequest("http://localhost/api/invoices/inv-1/mark-paid", { method: "POST" }), params("inv-1"));
    expect(res.status).toBe(403);
  });

  it("creates payment record and reminder log", async () => {
    mockSession();
    mockUser();
    const invoice = mockInvoice();
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    prisma.invoice.update.mockResolvedValue({ ...invoice, status: "paid", paidAt: new Date() });
    prisma.reminderLog.create.mockResolvedValue({});

    await MarkPaidPOST(createNextRequest("http://localhost/api/invoices/inv-1/mark-paid", { method: "POST" }), params("inv-1"));

    const reconciliation = await import("@/lib/reconciliation");
    expect(vi.mocked(reconciliation.createPaymentRecord)).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: "inv-1", source: "manual" }),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { POST } from "@/app/api/payouts/instant/route";

const mockPayoutsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    payouts: {
      create: mockPayoutsCreate,
    },
  })),
}));

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  mockPayoutsCreate.mockReset();
  const setup = await import("../setup");
  prisma = setup.prisma;
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
    status: "paid",
    notes: null,
    invoiceNumber: "INV-001",
    reminderScheduleId: null,
    paymentLink: null,
    paidAt: new Date("2025-06-15"),
    instantPayoutId: null,
    paidOutAt: null,
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

describe("POST /api/payouts/instant", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for free plan", async () => {
    mockSession();
    mockUser({ plan: "free" });

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Upgrade to Pro");
  });

  it("returns 200 for pro plan", async () => {
    mockSession();
    mockUser({ plan: "pro" });
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
    mockPayoutsCreate.mockResolvedValue({ id: "po_123", amount: 250000, fee: 2500, arrival_date: Math.floor(Date.now() / 1000) + 60 });
    prisma.invoice.update.mockResolvedValue(mockInvoice({ instantPayoutId: "po_123", paidOutAt: new Date() }));

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payoutId).toBe("po_123");
    expect(body.amount).toBe(250000);
  });

  it("returns 200 for agency plan", async () => {
    mockSession();
    mockUser({ plan: "agency" });
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
    mockPayoutsCreate.mockResolvedValue({ id: "po_456", amount: 250000, fee: 2500, arrival_date: Math.floor(Date.now() / 1000) + 60 });
    prisma.invoice.update.mockResolvedValue(mockInvoice({ instantPayoutId: "po_456", paidOutAt: new Date() }));

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payoutId).toBe("po_456");
  });

  it("returns 400 when invoiceId is missing", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when invoice does not exist", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "nonexistent" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 for other user's invoice", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ userId: "other-user" }));

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when invoice is not paid", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: "unpaid" }));

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("must be paid");
  });

  it("returns 400 when invoice already has an instant payout", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ instantPayoutId: "po_existing" }));

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already been requested");
  });

  it("returns 400 and Stripe error message on Stripe failure", async () => {
    mockSession();
    mockUser();
    prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
    mockPayoutsCreate.mockRejectedValue(new Error("Insufficient balance in your Stripe account."));

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Insufficient balance in your Stripe account.");
  });

  it("updates invoice with payout details on success", async () => {
    mockSession();
    mockUser();
    const invoice = mockInvoice();
    prisma.invoice.findUnique.mockResolvedValue(invoice);
    mockPayoutsCreate.mockResolvedValue({ id: "po_final", amount: 250000, fee: 2500, arrival_date: Math.floor(Date.now() / 1000) + 60 });
    prisma.invoice.update.mockResolvedValue({ ...invoice, instantPayoutId: "po_final", paidOutAt: new Date() });

    const req = createNextRequest("http://localhost/api/payouts/instant", {
      method: "POST",
      body: { invoiceId: "inv-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { instantPayoutId: "po_final", paidOutAt: expect.any(Date) },
    });
  });
});

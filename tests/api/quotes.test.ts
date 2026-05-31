import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { GET as ListGET, POST as CreatePOST } from "@/app/api/quotes/route";
import { GET as ItemGET, PUT as ItemPUT, DELETE as ItemDELETE } from "@/app/api/quotes/[id]/route";
import { POST as ConvertPOST } from "@/app/api/quotes/[id]/convert/route";

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

function mockQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-1",
    userId: "user-1",
    clientName: "Acme Corp",
    clientEmail: "billing@acme.com",
    clientAddress: null,
    issueDate: new Date("2025-06-01"),
    expiryDate: null,
    status: "draft",
    amount: 5000,
    subtotal: 5000,
    totalTax: 0,
    currency: "USD",
    notes: null,
    quoteNumber: "Q-001",
    convertedToInvoiceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [],
    ...overrides,
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/quotes", () => {
  it("returns 401 without session", async () => {
    const res = await ListGET(createNextRequest("http://localhost/api/quotes"));
    expect(res.status).toBe(401);
  });

  it("returns user's quotes", async () => {
    mockSession();
    mockUser();
    prisma.quote.findMany.mockResolvedValue([mockQuote()]);

    const res = await ListGET(createNextRequest("http://localhost/api/quotes"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quotes).toHaveLength(1);
  });
});

describe("POST /api/quotes", () => {
  it("returns 401 without session", async () => {
    const res = await CreatePOST(createNextRequest("http://localhost/api/quotes", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("creates quote with line items", async () => {
    mockSession();
    mockUser();
    prisma.quote.count.mockResolvedValue(0);
    prisma.quote.create.mockResolvedValue(mockQuote({ status: "draft" }));

    const res = await CreatePOST(createNextRequest("http://localhost/api/quotes", {
      method: "POST",
      body: {
        clientName: "Acme Corp",
        clientEmail: "billing@acme.com",
        amount: 5000,
        issueDate: "2025-06-01",
        lineItems: [{ description: "Consulting", quantity: 10, unitPrice: 500, total: 5000 }],
      },
    }));
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid body", async () => {
    mockSession();
    mockUser();
    const res = await CreatePOST(createNextRequest("http://localhost/api/quotes", {
      method: "POST",
      body: { amount: "bad" },
    }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for accountant session", async () => {
    vi.mocked(getOwnerIdForAccountant).mockResolvedValue("owner-1");
    mockSession("accountant@example.com");
    mockUser({ id: "owner-1" });

    const res = await CreatePOST(createNextRequest("http://localhost/api/quotes", {
      method: "POST",
      body: { clientName: "Test", clientEmail: "t@t.com", amount: 100, issueDate: "2025-06-01", lineItems: [] },
    }));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/quotes/[id]", () => {
  it("returns quote by id", async () => {
    mockSession();
    mockUser();
    prisma.quote.findFirst.mockResolvedValue(mockQuote());

    const res = await ItemGET(createNextRequest("http://localhost/api/quotes/quote-1"), params("quote-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quote.id).toBe("quote-1");
  });

  it("returns 404 for other user's quote", async () => {
    mockSession();
    mockUser();
    prisma.quote.findFirst.mockResolvedValue(null);

    const res = await ItemGET(createNextRequest("http://localhost/api/quotes/quote-1"), params("quote-1"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/quotes/[id]", () => {
  it("updates quote", async () => {
    mockSession();
    mockUser();
    prisma.quote.findFirst.mockResolvedValue(mockQuote({ status: "draft" }));
    prisma.quoteLineItem.deleteMany.mockResolvedValue({ count: 0 });
    prisma.quote.update.mockResolvedValue(mockQuote({ clientName: "Updated" }));

    const res = await ItemPUT(createNextRequest("http://localhost/api/quotes/quote-1", {
      method: "PUT",
      body: { clientName: "Updated", clientEmail: "u@u.com", amount: 6000, issueDate: "2025-06-01", lineItems: [] },
    }), params("quote-1"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/quotes/[id]", () => {
  it("deletes quote", async () => {
    mockSession();
    mockUser();
    prisma.quote.findFirst.mockResolvedValue(mockQuote({ status: "draft" }));
    prisma.quote.delete.mockResolvedValue(mockQuote());

    const res = await ItemDELETE(createNextRequest("http://localhost/api/quotes/quote-1", { method: "DELETE" }), params("quote-1"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/quotes/[id]/convert", () => {
  it("converts sent quote to invoice", async () => {
    mockSession();
    mockUser();
    prisma.quote.findFirst.mockResolvedValue(mockQuote({ status: "sent" }));
    prisma.invoice.create.mockResolvedValue({ id: "inv-new" });
    prisma.quote.update.mockResolvedValue(mockQuote({ status: "accepted" }));

    const res = await ConvertPOST(createNextRequest("http://localhost/api/quotes/quote-1/convert", { method: "POST" }), params("quote-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoiceId).toBe("inv-new");
  });

  it("returns 400 for draft quote", async () => {
    mockSession();
    mockUser();
    prisma.quote.findFirst.mockResolvedValue(mockQuote({ status: "draft" }));

    const res = await ConvertPOST(createNextRequest("http://localhost/api/quotes/quote-1/convert", { method: "POST" }), params("quote-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent quote", async () => {
    mockSession();
    mockUser();
    prisma.quote.findFirst.mockResolvedValue(null);

    const res = await ConvertPOST(createNextRequest("http://localhost/api/quotes/quote-99/convert", { method: "POST" }), params("quote-99"));
    expect(res.status).toBe(404);
  });
});

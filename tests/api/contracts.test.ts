import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { GET as ListGET, POST as CreatePOST } from "@/app/api/contracts/route";
import { GET as ItemGET, PUT as ItemPUT, DELETE as ItemDELETE } from "@/app/api/contracts/[id]/route";
import { POST as SendPOST } from "@/app/api/contracts/[id]/send/route";
import { POST as SignPOST } from "@/app/api/contracts/[id]/sign/route";

vi.mock("@/lib/contract-pdf", () => ({
  generateContractPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  const setup = await import("../setup");
  prisma = setup.prisma;
});

function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "tmpl-1",
    userId: null,
    name: "Freelance Service Agreement",
    body: "<p>Agreement with {{clientName}} for {{amount}}</p>",
    isDefault: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function mockContract(overrides: Record<string, unknown> = {}) {
  return {
    id: "contract-1",
    userId: "user-1",
    templateId: "tmpl-1",
    quoteId: null,
    invoiceId: null,
    clientName: "Acme Corp",
    clientEmail: "billing@acme.com",
    title: "Service Agreement",
    body: "<p>Agreement with Acme Corp for $5,000</p>",
    status: "draft",
    signingToken: "token-abc-123",
    signedAt: null,
    signedByName: null,
    signedByIp: null,
    pdfUrl: null,
    sentAt: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    template: { name: "Freelance Service Agreement" },
    ...overrides,
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/contracts", () => {
  it("returns 401 without session", async () => {
    const res = await ListGET(createNextRequest("http://localhost/api/contracts"));
    expect(res.status).toBe(401);
  });

  it("returns user's contracts", async () => {
    mockSession();
    mockUser();
    prisma.contract.findMany.mockResolvedValue([mockContract()]);

    const res = await ListGET(createNextRequest("http://localhost/api/contracts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].clientName).toBe("Acme Corp");
  });
});

describe("POST /api/contracts", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/contracts", {
      method: "POST",
      body: { templateId: "tmpl-1", clientName: "Test", clientEmail: "t@t.com", title: "Test", variables: {} },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(401);
  });

  it("creates contract from template", async () => {
    mockSession();
    mockUser();
    prisma.contractTemplate.findUnique.mockResolvedValue(mockTemplate());
    const created = mockContract();
    prisma.contract.create.mockResolvedValue(created);

    const req = createNextRequest("http://localhost/api/contracts", {
      method: "POST",
      body: {
        templateId: "tmpl-1",
        clientName: "Acme Corp",
        clientEmail: "billing@acme.com",
        title: "Service Agreement",
        variables: { amount: "$5,000" },
      },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.clientName).toBe("Acme Corp");
    expect(prisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          clientName: "Acme Corp",
        }),
      }),
    );
  });

  it("returns 400 for missing required fields", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/contracts", {
      method: "POST",
      body: { templateId: "tmpl-1" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when template not found", async () => {
    mockSession();
    mockUser();
    prisma.contractTemplate.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/contracts", {
      method: "POST",
      body: {
        templateId: "nonexistent",
        clientName: "Test",
        clientEmail: "t@t.com",
        title: "Test",
        variables: {},
      },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/contracts/[id]", () => {
  it("returns contract by id", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(mockContract());

    const res = await ItemGET(createNextRequest("http://localhost/api/contracts/contract-1"), params("contract-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("contract-1");
  });

  it("returns 404 for other user's contract", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(null);

    const res = await ItemGET(createNextRequest("http://localhost/api/contracts/nonexistent"), params("nonexistent"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/contracts/[id]", () => {
  it("updates draft contract", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(mockContract());
    const updated = mockContract({ clientName: "Updated Corp" });
    prisma.contract.update.mockResolvedValue(updated);

    const req = createNextRequest("http://localhost/api/contracts/contract-1", {
      method: "PUT",
      body: { clientName: "Updated Corp" },
    });
    const res = await ItemPUT(req, params("contract-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientName).toBe("Updated Corp");
  });

  it("returns 400 for non-draft contract", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(mockContract({ status: "sent" }));

    const req = createNextRequest("http://localhost/api/contracts/contract-1", {
      method: "PUT",
      body: { clientName: "Nope" },
    });
    const res = await ItemPUT(req, params("contract-1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/contracts/[id]", () => {
  it("deletes draft contract", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(mockContract());
    prisma.contract.delete.mockResolvedValue({} as any);

    const res = await ItemDELETE(createNextRequest("http://localhost/api/contracts/contract-1", { method: "DELETE" }), params("contract-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 for signed contract", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(mockContract({ status: "signed" }));

    const res = await ItemDELETE(createNextRequest("http://localhost/api/contracts/contract-1", { method: "DELETE" }), params("contract-1"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/contracts/[id]/send", () => {
  it("sends contract and updates status", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(mockContract());
    prisma.contract.update.mockResolvedValue(mockContract({ status: "sent", sentAt: new Date() }));
    prisma.notification.create.mockResolvedValue({} as any);

    const res = await SendPOST(createNextRequest("http://localhost/api/contracts/contract-1/send", { method: "POST" }), params("contract-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("sent");
    expect(body.signingUrl).toContain("/sign/");
  });

  it("returns 400 for already-sent contract", async () => {
    mockSession();
    mockUser();
    prisma.contract.findFirst.mockResolvedValue(mockContract({ status: "sent" }));

    const res = await SendPOST(createNextRequest("http://localhost/api/contracts/contract-1/send", { method: "POST" }), params("contract-1"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/contracts/[id]/sign", () => {
  it("signs contract with valid token", async () => {
    prisma.contract.findUnique.mockResolvedValue({
      id: "contract-1",
      userId: "user-1",
      quoteId: null,
      title: "Service Agreement",
      body: "<p>Agreement</p>",
      clientName: "Acme Corp",
      clientEmail: "billing@acme.com",
      status: "sent",
      signingToken: "token-abc-123",
      expiresAt: null,
      user: { name: "Test User", email: "test@example.com" },
    } as any);
    prisma.contract.update.mockResolvedValue({} as any);
    prisma.notification.create.mockResolvedValue({} as any);

    const req = createNextRequest("http://localhost/api/contracts/contract-1/sign", {
      method: "POST",
      body: { token: "token-abc-123", signedByName: "John Doe" },
    });
    const res = await SignPOST(req, params("contract-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("signed");
  });

  it("rejects invalid token", async () => {
    prisma.contract.findUnique.mockResolvedValue({
      id: "contract-1",
      status: "sent",
      signingToken: "token-abc-123",
    } as any);

    const req = createNextRequest("http://localhost/api/contracts/contract-1/sign", {
      method: "POST",
      body: { token: "wrong-token", signedByName: "John Doe" },
    });
    const res = await SignPOST(req, params("contract-1"));
    expect(res.status).toBe(403);
  });

  it("rejects already-signed contract", async () => {
    prisma.contract.findUnique.mockResolvedValue({
      id: "contract-1",
      status: "signed",
      signingToken: "token-abc-123",
    } as any);

    const req = createNextRequest("http://localhost/api/contracts/contract-1/sign", {
      method: "POST",
      body: { token: "token-abc-123", signedByName: "John Doe" },
    });
    const res = await SignPOST(req, params("contract-1"));
    expect(res.status).toBe(400);
  });

  it("updates linked quote status to accepted", async () => {
    prisma.contract.findUnique.mockResolvedValue({
      id: "contract-1",
      userId: "user-1",
      quoteId: "quote-1",
      title: "Test",
      body: "<p>Body</p>",
      clientName: "Acme",
      clientEmail: "a@a.com",
      status: "sent",
      signingToken: "token-abc-123",
      expiresAt: null,
      user: { name: "Test User", email: "test@example.com" },
    } as any);
    prisma.contract.update.mockResolvedValue({} as any);
    prisma.quote.update.mockResolvedValue({} as any);
    prisma.notification.create.mockResolvedValue({} as any);

    const req = createNextRequest("http://localhost/api/contracts/contract-1/sign", {
      method: "POST",
      body: { token: "token-abc-123", signedByName: "John Doe" },
    });
    await SignPOST(req, params("contract-1"));

    expect(prisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "quote-1" },
        data: { status: "accepted" },
      }),
    );
  });

  it("requires signedByName field", async () => {
    const req = createNextRequest("http://localhost/api/contracts/contract-1/sign", {
      method: "POST",
      body: { token: "token-abc-123", signedByName: "" },
    });
    const res = await SignPOST(req, params("contract-1"));
    expect(res.status).toBe(400);
  });
});

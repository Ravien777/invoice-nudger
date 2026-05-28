import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePortalToken, getPortalUrl, createPortalToken, validatePortalToken, getClientInvoices } from "@/lib/portal";

describe("generatePortalToken", () => {
  it("returns a variable-length base64url string (43-44 chars)", () => {
    const token = generatePortalToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generatePortalToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("getPortalUrl", () => {
  const originalUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalUrl;
  });

  it("returns URL with token appended", () => {
    process.env.NEXTAUTH_URL = "https://app.example.com";
    const url = getPortalUrl("abc123");
    expect(url).toBe("https://app.example.com/portal/abc123");
  });

  it("falls back to localhost when NEXTAUTH_URL is not set", () => {
    delete process.env.NEXTAUTH_URL;
    const url = getPortalUrl("test-token");
    expect(url).toBe("http://localhost:3000/portal/test-token");
  });
});

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  const setup = await import("../setup");
  prisma = setup.prisma;
});

describe("createPortalToken", () => {
  it("creates a token record and returns portalUrl", async () => {
    prisma.clientPortalToken.create.mockResolvedValue({
      id: "token-1",
      token: "generated-token",
      clientEmail: "client@example.com",
      clientName: null,
      expiresAt: null,
      createdAt: new Date("2025-06-01"),
    });

    const result = await createPortalToken("user-1", "client@example.com");

    expect(result.id).toBe("token-1");
    expect(result.clientEmail).toBe("client@example.com");
    expect(result.portalUrl).toContain("/portal/generated-token");
    expect(result.clientName).toBeNull();
  });

  it("passes options to prisma create", async () => {
    prisma.clientPortalToken.create.mockResolvedValue({
      id: "token-2",
      token: "another-token",
      clientEmail: "client@example.com",
      clientName: "Acme Corp",
      expiresAt: new Date("2025-09-01"),
      createdAt: new Date("2025-06-01"),
    });

    const expiry = new Date("2025-09-01");
    await createPortalToken("user-1", "client@example.com", {
      clientName: "Acme Corp",
      expiresAt: expiry,
    });

    expect(prisma.clientPortalToken.create).toHaveBeenCalledWith({
      data: {
        token: expect.any(String),
        userId: "user-1",
        clientEmail: "client@example.com",
        clientName: "Acme Corp",
        expiresAt: expiry,
      },
    });
  });
});

describe("validatePortalToken", () => {
  it("returns null when token not found", async () => {
    prisma.clientPortalToken.findUnique.mockResolvedValue(null);

    const result = await validatePortalToken("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when token is inactive", async () => {
    prisma.clientPortalToken.findUnique.mockResolvedValue({
      id: "token-1",
      token: "abc",
      userId: "user-1",
      clientEmail: "client@example.com",
      clientName: null,
      isActive: false,
      expiresAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      user: { id: "user-1", name: "Test", email: "test@test.com", portalEnabled: true, portalBranding: null },
    });

    const result = await validatePortalToken("abc");
    expect(result).toBeNull();
  });

  it("returns null when token is expired", async () => {
    prisma.clientPortalToken.findUnique.mockResolvedValue({
      id: "token-1",
      token: "abc",
      userId: "user-1",
      clientEmail: "client@example.com",
      clientName: null,
      isActive: true,
      expiresAt: new Date(Date.now() - 1000),
      lastAccessedAt: null,
      createdAt: new Date(),
      user: { id: "user-1", name: "Test", email: "test@test.com", portalEnabled: true, portalBranding: null },
    });

    const result = await validatePortalToken("abc");
    expect(result).toBeNull();
  });

  it("returns validated data for valid token", async () => {
    const future = new Date(Date.now() + 86400000);
    prisma.clientPortalToken.findUnique.mockResolvedValue({
      id: "token-1",
      token: "abc",
      userId: "user-1",
      clientEmail: "client@example.com",
      clientName: "Acme Client",
      isActive: true,
      expiresAt: future,
      lastAccessedAt: null,
      createdAt: new Date(),
      user: { id: "user-1", name: "Business Owner", email: "owner@test.com", portalEnabled: true, portalBranding: null },
    });
    prisma.clientPortalToken.update.mockResolvedValue({});

    const result = await validatePortalToken("abc");

    expect(result).not.toBeNull();
    expect(result!.clientEmail).toBe("client@example.com");
    expect(result!.clientName).toBe("Acme Client");
    expect(result!.userId).toBe("user-1");
    expect(result!.branding.businessName).toBe("Business Owner");
    expect(prisma.clientPortalToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "token-1" },
        data: expect.objectContaining({ lastAccessedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("getClientInvoices", () => {
  it("fetches invoices for userId and clientEmail", async () => {
    const mockInvoices = [
      { id: "inv-1", invoiceNumber: "INV-001", projectName: "Project A", amount: 1000, currency: "USD", dueDate: new Date("2025-07-01"), status: "unpaid", notes: null, paymentLink: null, paidAt: null, createdAt: new Date("2025-06-01") },
      { id: "inv-2", invoiceNumber: "INV-002", projectName: null, amount: 2000, currency: "USD", dueDate: new Date("2025-08-01"), status: "paid", notes: null, paymentLink: "https://pay.test", paidAt: new Date("2025-07-15"), createdAt: new Date("2025-06-15") },
    ];

    prisma.invoice.findMany.mockResolvedValue(mockInvoices);

    const invoices = await getClientInvoices("user-1", "client@example.com");

    expect(invoices).toHaveLength(2);
    expect(invoices[0].invoiceNumber).toBe("INV-001");
    expect(invoices[1].paidAt).toEqual(mockInvoices[1].paidAt);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", clientEmail: "client@example.com" },
      orderBy: { dueDate: "desc" },
    });
  });

  it("returns empty array when no invoices exist", async () => {
    prisma.invoice.findMany.mockResolvedValue([]);

    const invoices = await getClientInvoices("user-1", "client@example.com");
    expect(invoices).toHaveLength(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { mockSession, mockUser, createNextRequest } from "../../helpers";
import { POST as GeneratePOST } from "@/app/api/portal/generate/route";

vi.mock("@/lib/accountant-session");

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  vi.mocked(getOwnerIdForAccountant).mockReset();
  vi.mocked(getOwnerIdForAccountant).mockResolvedValue(null);
  const setup = await import("../../setup");
  prisma = setup.prisma;
});

describe("POST /api/portal/generate", () => {
  it("returns 401 without authentication", async () => {
    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for accountant session", async () => {
    vi.mocked(getOwnerIdForAccountant).mockResolvedValue("owner-1");
    mockSession("accountant@example.com");
    mockUser({ id: "accountant-1" });

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for Free plan users", async () => {
    mockSession("free@example.com");
    mockUser({ id: "free-user", plan: "free" });

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid email", async () => {
    mockSession();
    mockUser();

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "not-an-email" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing clientEmail", async () => {
    mockSession();
    mockUser();

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: {},
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a new token and returns portalUrl for pro user", async () => {
    mockSession();
    mockUser();

    prisma.clientPortalToken.findFirst.mockResolvedValue(null);
    prisma.clientPortalToken.create.mockResolvedValue({
      id: "token-1",
      clientEmail: "client@example.com",
      token: "abc123",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com", clientName: "Client Name" },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.portalUrl).toContain("/portal/");
    expect(body.token.clientEmail).toBe("client@example.com");
    expect(body.token.id).toBe("token-1");
    expect(body.token.expiresAt).toBeTruthy();

    expect(prisma.clientPortalToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          clientEmail: "client@example.com",
          clientName: "Client Name",
        }),
      }),
    );
  });

  it("upserts token for existing clientEmail (refreshes token and expiry)", async () => {
    mockSession();
    mockUser();

    const existingToken = {
      id: "token-existing",
      clientEmail: "client@example.com",
      token: "old-token",
      expiresAt: new Date(Date.now() - 1),
      isActive: false,
    };

    prisma.clientPortalToken.findFirst.mockResolvedValue(existingToken);
    prisma.clientPortalToken.update.mockResolvedValue({
      ...existingToken,
      token: "new-token",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com" },
      }),
    );

    expect(res.status).toBe(200);
    expect(prisma.clientPortalToken.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", clientEmail: "client@example.com" },
    });
    expect(prisma.clientPortalToken.update).toHaveBeenCalled();
    expect(prisma.clientPortalToken.create).not.toHaveBeenCalled();
  });

  it("generates the portal invite email template", async () => {
    mockSession();
    mockUser();

    prisma.clientPortalToken.findFirst.mockResolvedValue(null);
    prisma.clientPortalToken.create.mockResolvedValue({
      id: "token-1",
      clientEmail: "client@example.com",
      token: "abc123",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com", clientName: "Jane" },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.portalUrl).toContain("/portal/");
  });

  it("creates an in-app notification", async () => {
    mockSession();
    mockUser();

    prisma.clientPortalToken.findFirst.mockResolvedValue(null);
    prisma.clientPortalToken.create.mockResolvedValue({
      id: "token-1",
      clientEmail: "client@example.com",
      token: "abc123",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com" },
      }),
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "portal_invite",
        message: expect.stringContaining("client@example.com"),
      }),
    });
  });

  it("creates token without clientName when not provided", async () => {
    mockSession();
    mockUser();

    prisma.clientPortalToken.findFirst.mockResolvedValue(null);
    prisma.clientPortalToken.create.mockResolvedValue({
      id: "token-2",
      clientEmail: "client@example.com",
      token: "def456",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    const res = await GeneratePOST(
      createNextRequest("http://localhost/api/portal/generate", {
        method: "POST",
        body: { clientEmail: "client@example.com" },
      }),
    );

    expect(res.status).toBe(200);
    expect(prisma.clientPortalToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientName: null,
        }),
      }),
    );
  });
});

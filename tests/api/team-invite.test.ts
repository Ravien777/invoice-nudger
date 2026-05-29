import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { POST as invitePOST } from "@/app/api/team/invite/route";
import { POST as acceptPOST } from "@/app/api/team/accept/route";
import { DELETE as removeDELETE } from "@/app/api/team/[id]/remove/route";

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  const setup = await import("../setup");
  prisma = setup.prisma;
});

function mockAgencyUser(overrides: Record<string, unknown> = {}) {
  mockUser({ plan: "agency", ...overrides });
}

describe("POST /api/team/invite", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/team/invite", {
      method: "POST",
      body: { email: "team@example.com" },
    });
    const res = await invitePOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 without email", async () => {
    mockSession();
    mockAgencyUser();
    const req = createNextRequest("http://localhost/api/team/invite", {
      method: "POST",
      body: {},
    });
    const res = await invitePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-agency plan", async () => {
    mockSession();
    mockUser({ plan: "free" });
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", plan: "free" });
    const req = createNextRequest("http://localhost/api/team/invite", {
      method: "POST",
      body: { email: "team@example.com" },
    });
    const res = await invitePOST(req);
    expect(res.status).toBe(403);
  });

  it("creates invite and sends email on agency plan", async () => {
    mockSession();
    mockAgencyUser();
    prisma.teamMember.count.mockResolvedValue(0);
    prisma.teamMember.findUnique.mockResolvedValue(null);
    prisma.teamMember.create.mockResolvedValue({
      id: "tm-1",
      ownerId: "user-1",
      memberEmail: "team@example.com",
      role: "member",
      status: "pending",
      inviteToken: "tok-1",
      invitedAt: new Date(),
    });

    const req = createNextRequest("http://localhost/api/team/invite", {
      method: "POST",
      body: { email: "team@example.com", role: "member" },
    });
    const res = await invitePOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("pending");
  });

  it("returns 409 for duplicate pending invite", async () => {
    mockSession();
    mockAgencyUser();
    prisma.teamMember.count.mockResolvedValue(1);
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      ownerId: "user-1",
      memberEmail: "team@example.com",
      status: "pending",
    });

    const req = createNextRequest("http://localhost/api/team/invite", {
      method: "POST",
      body: { email: "team@example.com" },
    });
    const res = await invitePOST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 when max seats reached", async () => {
    mockSession();
    mockAgencyUser();
    prisma.teamMember.count.mockResolvedValue(5);
    prisma.teamMember.findUnique.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/team/invite", {
      method: "POST",
      body: { email: "team@example.com" },
    });
    const res = await invitePOST(req);
    expect(res.status).toBe(400);
  });

  it("re-activates a previously removed invite", async () => {
    mockSession();
    mockAgencyUser();
    prisma.teamMember.count.mockResolvedValue(1);
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      ownerId: "user-1",
      memberEmail: "team@example.com",
      status: "removed",
    });
    prisma.teamMember.update.mockResolvedValue({ id: "tm-1" });

    const req = createNextRequest("http://localhost/api/team/invite", {
      method: "POST",
      body: { email: "team@example.com", role: "viewer" },
    });
    const res = await invitePOST(req);
    expect(res.status).toBe(200);
    expect(prisma.teamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tm-1" },
        data: expect.objectContaining({ status: "pending", role: "viewer" }),
      }),
    );
  });
});

describe("POST /api/team/accept", () => {
  it("returns 400 without token", async () => {
    const req = createNextRequest("http://localhost/api/team/accept");
    const res = await acceptPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for invalid token", async () => {
    prisma.teamMember.findUnique.mockResolvedValue(null);
    const req = createNextRequest("http://localhost/api/team/accept?token=invalid");
    const res = await acceptPOST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-pending invite", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      memberEmail: "team@example.com",
      status: "active",
    });
    const req = createNextRequest("http://localhost/api/team/accept?token=tok-1");
    const res = await acceptPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 without session", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      memberEmail: "team@example.com",
      status: "pending",
    });
    const req = createNextRequest("http://localhost/api/team/accept?token=tok-1");
    const res = await acceptPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when email does not match", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      memberEmail: "other@example.com",
      status: "pending",
    });
    mockSession("wrong@example.com");
    const req = createNextRequest("http://localhost/api/team/accept?token=tok-1");
    const res = await acceptPOST(req);
    expect(res.status).toBe(403);
  });

  it("accepts invite with matching email", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      memberEmail: "team@example.com",
      status: "pending",
    });
    mockSession("team@example.com");
    prisma.user.findUnique.mockResolvedValue({ id: "user-2" });

    const req = createNextRequest("http://localhost/api/team/accept?token=tok-1");
    const res = await acceptPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("active");
  });
});

describe("DELETE /api/team/[id]/remove", () => {
  const mockReq = createNextRequest("http://localhost/api/team/tm-1/remove", {
    method: "DELETE",
  });

  it("returns 401 without session", async () => {
    const res = await removeDELETE(mockReq, { params: Promise.resolve({ id: "tm-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when team member not found", async () => {
    mockSession();
    mockUser();
    prisma.teamMember.findUnique.mockResolvedValue(null);
    const res = await removeDELETE(mockReq, { params: Promise.resolve({ id: "tm-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-owner tries to remove", async () => {
    mockSession();
    mockUser({ id: "other-user" });
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      ownerId: "user-1",
      status: "active",
    });
    const res = await removeDELETE(mockReq, { params: Promise.resolve({ id: "tm-1" }) });
    expect(res.status).toBe(403);
  });

  it("removes team member as owner", async () => {
    mockSession();
    mockUser();
    prisma.teamMember.findUnique.mockResolvedValue({
      id: "tm-1",
      ownerId: "user-1",
      status: "active",
    });
    const res = await removeDELETE(mockReq, { params: Promise.resolve({ id: "tm-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("removed");
    expect(prisma.teamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tm-1" },
        data: expect.objectContaining({ status: "removed" }),
      }),
    );
  });
});

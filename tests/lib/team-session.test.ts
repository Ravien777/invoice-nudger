import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession } from "../helpers";

let prisma: any;
let getTeamContext: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  const setup = await import("../setup");
  prisma = setup.prisma;
  const teamSession = await import("@/lib/team-session");
  getTeamContext = teamSession.getTeamContext;
});

describe("getTeamContext", () => {
  it("returns null when no session", async () => {
    const ctx = await getTeamContext(null);
    expect(ctx).toBeNull();
  });

  it("returns null when session has no email", async () => {
    const ctx = await getTeamContext({ user: {} } as any);
    expect(ctx).toBeNull();
  });

  it("returns null when user not found", async () => {
    mockSession("test@example.com");
    prisma.user.findUnique.mockResolvedValue(null);
    const session = await getServerSession();
    const ctx = await getTeamContext(session);
    expect(ctx).toBeNull();
  });

  it("returns null when user is not a team member", async () => {
    mockSession("test@example.com");
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.teamMember.findFirst.mockResolvedValue(null);
    const session = await getServerSession();
    const ctx = await getTeamContext(session);
    expect(ctx).toBeNull();
  });

  it("returns context for active member", async () => {
    mockSession("test@example.com");
    prisma.user.findUnique.mockResolvedValue({ id: "user-2" });
    prisma.teamMember.findFirst.mockResolvedValue({
      ownerId: "owner-1",
      role: "member",
    });
    const session = await getServerSession();
    const ctx = await getTeamContext(session);
    expect(ctx).toEqual({ ownerId: "owner-1", role: "member" });
  });

  it("returns context for active viewer", async () => {
    mockSession("test@example.com");
    prisma.user.findUnique.mockResolvedValue({ id: "user-2" });
    prisma.teamMember.findFirst.mockResolvedValue({
      ownerId: "owner-1",
      role: "viewer",
    });
    const session = await getServerSession();
    const ctx = await getTeamContext(session);
    expect(ctx).toEqual({ ownerId: "owner-1", role: "viewer" });
  });

  it("returns null for pending team member", async () => {
    mockSession("test@example.com");
    prisma.user.findUnique.mockResolvedValue({ id: "user-2" });
    prisma.teamMember.findFirst.mockResolvedValue(null);
    const session = await getServerSession();
    const ctx = await getTeamContext(session);
    expect(ctx).toBeNull();
  });
});

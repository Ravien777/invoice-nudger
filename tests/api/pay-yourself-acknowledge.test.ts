import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";
import { getServerSession } from "next-auth";

async function callHandler() {
  const { POST } = await import("@/app/api/allocation/pay-yourself-acknowledge/route");
  return POST();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "test@example.com" },
  } as any);
});

describe("POST /api/allocation/pay-yourself-acknowledge", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const response = await callHandler();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("updates lastPayYourselfDate on businessProfile", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      businessProfile: { id: "bp-1" },
    } as any);
    vi.mocked(prisma.businessProfile.update).mockResolvedValue({} as any);

    const response = await callHandler();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    expect(prisma.businessProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bp-1" },
        data: expect.objectContaining({ lastPayYourselfDate: expect.any(Date) }),
      }),
    );
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const response = await callHandler();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("User not found");
  });

  it("succeeds even when no businessProfile exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      businessProfile: null,
    } as any);

    const response = await callHandler();
    expect(response.status).toBe(200);
    expect(prisma.businessProfile.update).not.toHaveBeenCalled();
  });
});

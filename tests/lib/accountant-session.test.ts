import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOwnerIdForAccountant", () => {
  it("returns ownerId when active access exists", async () => {
    vi.mocked(prisma.accountantAccess.findFirst).mockResolvedValue({
      ownerId: "owner-1",
    } as any);
    const result = await getOwnerIdForAccountant("accountant@example.com");
    expect(result).toBe("owner-1");
  });

  it("returns null when no access record exists", async () => {
    vi.mocked(prisma.accountantAccess.findFirst).mockResolvedValue(null);
    const result = await getOwnerIdForAccountant("unknown@example.com");
    expect(result).toBeNull();
  });

  it("queries with status active filter", async () => {
    vi.mocked(prisma.accountantAccess.findFirst).mockResolvedValue({
      ownerId: "owner-1",
    } as any);
    await getOwnerIdForAccountant("test@example.com");
    expect(prisma.accountantAccess.findFirst).toHaveBeenCalledWith({
      where: { accountantEmail: "test@example.com", status: "active" },
      select: { ownerId: true },
    });
  });

  it("returns null when findFirst returns null (inactive or revoked)", async () => {
    vi.mocked(prisma.accountantAccess.findFirst).mockResolvedValue(null);
    const result = await getOwnerIdForAccountant("nonexistent@example.com");
    expect(result).toBeNull();
  });
});

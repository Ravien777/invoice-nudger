import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser, createNextRequest } from "../../helpers";
import { GET, PUT } from "@/app/api/allocation/profile/route";

vi.mock("@/lib/reconciliation");

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  const setup = await import("../../setup");
  prisma = setup.prisma;
});

describe("GET /api/allocation/profile", () => {
  it("returns 401 without session", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns default profile when none exists", async () => {
    mockSession();
    mockUser();
    prisma.allocationProfile.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taxPercent).toBe(25);
    expect(body.operatingPercent).toBe(30);
    expect(body.profitPercent).toBe(5);
    expect(body.ownerPayPercent).toBe(40);
  });

  it("returns saved profile when one exists", async () => {
    mockSession();
    mockUser();
    prisma.allocationProfile.findUnique.mockResolvedValue({
      id: "ap-1",
      userId: "user-1",
      taxPercent: 20,
      operatingPercent: 30,
      profitPercent: 10,
      ownerPayPercent: 40,
      currency: "USD",
      updatedAt: new Date(),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taxPercent).toBe(20);
    expect(body.profitPercent).toBe(10);
  });
});

describe("PUT /api/allocation/profile", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/allocation/profile", {
      method: "PUT",
      body: { taxPercent: 25, operatingPercent: 30, profitPercent: 5, ownerPayPercent: 40 },
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it("upserts profile with valid data", async () => {
    mockSession();
    mockUser();
    const updated = {
      id: "ap-1",
      userId: "user-1",
      taxPercent: 20,
      operatingPercent: 30,
      profitPercent: 10,
      ownerPayPercent: 40,
      currency: "USD",
      updatedAt: new Date(),
    };
    prisma.allocationProfile.upsert.mockResolvedValue(updated);

    const req = createNextRequest("http://localhost/api/allocation/profile", {
      method: "PUT",
      body: { taxPercent: 20, operatingPercent: 30, profitPercent: 10, ownerPayPercent: 40 },
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taxPercent).toBe(20);
    expect(body.profitPercent).toBe(10);
  });

  it("returns 400 when percentages do not sum to 100", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/allocation/profile", {
      method: "PUT",
      body: { taxPercent: 50, operatingPercent: 50, profitPercent: 5, ownerPayPercent: 0 },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for missing fields", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/allocation/profile", {
      method: "PUT",
      body: { taxPercent: 50 },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative percentages", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/allocation/profile", {
      method: "PUT",
      body: { taxPercent: -10, operatingPercent: 50, profitPercent: 30, ownerPayPercent: 30 },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

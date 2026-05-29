import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { GET as ListGET, POST as CreatePOST } from "@/app/api/contractors/route";
import { GET as ItemGET, PUT as ItemPUT, DELETE as ItemDELETE } from "@/app/api/contractors/[id]/route";

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  const setup = await import("../setup");
  prisma = setup.prisma;
});

function mockContractor(overrides: Record<string, unknown> = {}) {
  return {
    id: "contractor-1",
    userId: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "Designer",
    rate: 100,
    rateType: "hourly",
    taxId: null,
    createdAt: new Date(),
    payments: [],
    _count: { payments: 0 },
    ...overrides,
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/contractors (list)", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/contractors");
    const res = await ListGET();
    expect(res.status).toBe(401);
  });

  it("returns user's contractors", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findMany.mockResolvedValue([mockContractor()]);

    const res = await ListGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Jane Doe");
  });
});

describe("POST /api/contractors (create)", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/contractors", {
      method: "POST",
      body: { name: "John", email: "john@test.com" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(401);
  });

  it("creates contractor with valid data", async () => {
    mockSession();
    mockUser();
    prisma.contractor.create.mockResolvedValue(mockContractor());

    const req = createNextRequest("http://localhost/api/contractors", {
      method: "POST",
      body: { name: "Jane Doe", email: "jane@example.com" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Jane Doe");
  });

  it("returns 400 when name is missing", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/contractors", {
      method: "POST",
      body: { email: "jane@example.com" },
    });
    const res = await CreatePOST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/contractors/[id] (single)", () => {
  it("returns contractor by id", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());

    const res = await ItemGET(createNextRequest("http://localhost/api/contractors/contractor-1"), params("contractor-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("contractor-1");
  });

  it("returns 404 when contractor belongs to other user", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findFirst.mockResolvedValue(null);

    const res = await ItemGET(createNextRequest("http://localhost/api/contractors/contractor-1"), params("contractor-1"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/contractors/[id]", () => {
  it("updates contractor", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.contractor.update.mockResolvedValue(mockContractor({ name: "Jane Smith" }));

    const req = createNextRequest("http://localhost/api/contractors/contractor-1", {
      method: "PUT",
      body: { name: "Jane Smith" },
    });
    const res = await ItemPUT(req, params("contractor-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Jane Smith");
  });

  it("returns 404 for other user's contractor", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findFirst.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/contractors/contractor-1", {
      method: "PUT",
      body: { name: "Hacker" },
    });
    const res = await ItemPUT(req, params("contractor-1"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/contractors/[id]", () => {
  it("deletes contractor with no payments", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.contractor.delete.mockResolvedValue(mockContractor());

    const res = await ItemDELETE(createNextRequest("http://localhost/api/contractors/contractor-1", { method: "DELETE" }), params("contractor-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 when contractor has payments", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findFirst.mockResolvedValue(
      mockContractor({ payments: [{ id: "payment-1" }] }),
    );

    const res = await ItemDELETE(createNextRequest("http://localhost/api/contractors/contractor-1", { method: "DELETE" }), params("contractor-1"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Cannot delete");
  });

  it("returns 404 for other user's contractor", async () => {
    mockSession();
    mockUser();
    prisma.contractor.findFirst.mockResolvedValue(null);

    const res = await ItemDELETE(createNextRequest("http://localhost/api/contractors/contractor-1", { method: "DELETE" }), params("contractor-1"));
    expect(res.status).toBe(404);
  });
});

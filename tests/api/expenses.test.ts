import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { GET, POST } from "@/app/api/expenses/route";

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

function mockExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    userId: "user-1",
    categoryId: null,
    description: "Office supplies",
    amount: 50,
    currency: "USD",
    date: new Date("2025-06-01"),
    vendor: null,
    receiptUrl: null,
    notes: null,
    taxDeductible: false,
    recurring: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: null,
    ...overrides,
  };
}

describe("GET /api/expenses", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/expenses");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when user not found", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const req = createNextRequest("http://localhost/api/expenses");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns user's expenses with pagination", async () => {
    mockSession();
    mockUser();
    prisma.expense.findMany.mockResolvedValue([mockExpense()]);
    prisma.expense.count.mockResolvedValue(1);
    prisma.expenseCategory.findMany.mockResolvedValue([]);

    const req = createNextRequest("http://localhost/api/expenses");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expenses).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("queries expenses with correct userId", async () => {
    mockSession();
    mockUser();
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.expense.count.mockResolvedValue(0);
    prisma.expenseCategory.findMany.mockResolvedValue([]);

    await GET(createNextRequest("http://localhost/api/expenses"));
    const where = prisma.expense.findMany.mock.calls[0][0]?.where;
    expect(where).toMatchObject({ userId: "user-1" });
  });
});

describe("POST /api/expenses", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: { description: "x", amount: 1, date: "2025-06-01" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates expense with valid data", async () => {
    mockSession();
    mockUser();
    const created = mockExpense();
    prisma.expense.create.mockResolvedValue(created);

    const req = createNextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: { description: "Office supplies", amount: 50, date: "2025-06-01" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.expense.description).toBe("Office supplies");
  });

  it("returns 400 for invalid body", async () => {
    mockSession();
    mockUser();
    const req = createNextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: { amount: "not-a-number" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 for accountant session", async () => {
    vi.mocked(getOwnerIdForAccountant).mockResolvedValue("owner-1");
    mockSession("accountant@example.com");
    mockUser({ id: "owner-1" });

    const req = createNextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: { description: "Test", amount: 100, date: "2025-06-01" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates expense with receiptUrl when provided", async () => {
    mockSession();
    mockUser();
    const created = mockExpense({ receiptUrl: "https://blob.test/receipt.jpg" });
    prisma.expense.create.mockResolvedValue(created);

    const req = createNextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: {
        description: "With receipt",
        amount: 200,
        date: "2025-06-01",
        receiptUrl: "https://blob.test/receipt.jpg",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.expense.receiptUrl).toBe("https://blob.test/receipt.jpg");
  });
});

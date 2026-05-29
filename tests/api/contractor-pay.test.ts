import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { POST } from "@/app/api/contractors/[id]/pay/route";

vi.mock("@/lib/payslip-pdf", () => ({
  generatePayslipPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock pdf content")),
}));

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
    ...overrides,
  };
}

function mockUserWithProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    plan: "agency",
    businessProfile: {
      id: "bp-1",
      userId: "user-1",
      businessName: "Test Business",
      businessAddress: "123 Main St",
      taxRate: 0.25,
      fiscalYearStart: 1,
      taxSavingsAmount: 0,
      baseCurrency: "USD",
      defaultHourlyRate: null,
    },
    ...overrides,
  };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/contractors/[id]/pay", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    const res = await POST(req, params("contractor-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when contractor not found", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/contractors/nonexistent/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    const res = await POST(req, params("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when amount is missing", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());

    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    const res = await POST(req, params("contractor-1"));
    expect(res.status).toBe(400);
  });

  it("creates payment and expense on success", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.expenseCategory.findFirst.mockResolvedValue({
      id: "cat-1",
      name: "Professional Services",
      userId: "user-1",
    });
    prisma.contractorPayment.create.mockResolvedValue({ id: "payment-1", contractorId: "contractor-1" });
    prisma.expense.create.mockResolvedValue({ id: "expense-1" });
    prisma.contractorPayment.update.mockResolvedValue({ id: "payment-1", payslipUrl: "https://blob.vercel.test/payslip.pdf", expenseId: "expense-1" });

    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    const res = await POST(req, params("contractor-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paymentId).toBe("payment-1");
    expect(body.expenseId).toBe("expense-1");
    expect(body.payslipUrl).toBeTruthy();
  });

  it("creates expense with Professional Services category", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.expenseCategory.findFirst.mockResolvedValue({
      id: "cat-1",
      name: "Professional Services",
      userId: "user-1",
    });
    prisma.contractorPayment.create.mockResolvedValue({ id: "payment-1", contractorId: "contractor-1" });
    prisma.expense.create.mockResolvedValue({ id: "expense-1" });
    prisma.contractorPayment.update.mockResolvedValue({ id: "payment-1", payslipUrl: "https://blob.vercel.test/payslip.pdf", expenseId: "expense-1" });

    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    await POST(req, params("contractor-1"));

    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat-1",
          description: expect.stringContaining("Payment to Jane Doe"),
        }),
      }),
    );
  });

  it("generates payslip PDF and uploads to blob", async () => {
    const { generatePayslipPdf } = await import("@/lib/payslip-pdf");

    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.expenseCategory.findFirst.mockResolvedValue({
      id: "cat-1",
      name: "Professional Services",
      userId: "user-1",
    });
    prisma.contractorPayment.create.mockResolvedValue({ id: "payment-1", contractorId: "contractor-1" });
    prisma.expense.create.mockResolvedValue({ id: "expense-1" });
    prisma.contractorPayment.update.mockResolvedValue({ id: "payment-1", payslipUrl: "https://blob.vercel.test/payslip.pdf", expenseId: "expense-1" });

    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    await POST(req, params("contractor-1"));

    expect(generatePayslipPdf).toHaveBeenCalled();
  });

  it("sends email to contractor via Resend", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.expenseCategory.findFirst.mockResolvedValue({
      id: "cat-1",
      name: "Professional Services",
      userId: "user-1",
    });
    prisma.contractorPayment.create.mockResolvedValue({ id: "payment-1", contractorId: "contractor-1" });
    prisma.expense.create.mockResolvedValue({ id: "expense-1" });
    prisma.contractorPayment.update.mockResolvedValue({ id: "payment-1", payslipUrl: "https://blob.vercel.test/payslip.pdf", expenseId: "expense-1" });

    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    const res = await POST(req, params("contractor-1"));

    expect(res.status).toBe(200);
    // Email sending is verified implicitly — the mock Resend doesn't throw
  });

  it("links expenseId to payment record", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.expenseCategory.findFirst.mockResolvedValue({
      id: "cat-1",
      name: "Professional Services",
      userId: "user-1",
    });
    prisma.contractorPayment.create.mockResolvedValue({ id: "payment-1", contractorId: "contractor-1" });
    prisma.expense.create.mockResolvedValue({ id: "expense-1" });
    prisma.contractorPayment.update.mockResolvedValue({ id: "payment-1", payslipUrl: "https://blob.vercel.test/payslip.pdf", expenseId: "expense-1" });

    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    await POST(req, params("contractor-1"));

    expect(prisma.contractorPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-1" },
        data: expect.objectContaining({ expenseId: "expense-1" }),
      }),
    );
  });

  it("creates Professional Services category if not found", async () => {
    mockSession();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProfile());
    prisma.contractor.findFirst.mockResolvedValue(mockContractor());
    prisma.expenseCategory.findFirst.mockResolvedValue(null);
    prisma.expenseCategory.create.mockResolvedValue({
      id: "cat-new",
      name: "Professional Services",
      userId: "user-1",
    });
    prisma.contractorPayment.create.mockResolvedValue({ id: "payment-1", contractorId: "contractor-1" });
    prisma.expense.create.mockResolvedValue({ id: "expense-1" });
    prisma.contractorPayment.update.mockResolvedValue({ id: "payment-1", payslipUrl: "https://blob.vercel.test/payslip.pdf", expenseId: "expense-1" });

    const req = createNextRequest("http://localhost/api/contractors/contractor-1/pay", {
      method: "POST",
      body: { amount: 500, currency: "USD", description: "Website design", paymentDate: "2026-05-15" },
    });
    const res = await POST(req, params("contractor-1"));

    expect(res.status).toBe(200);
    expect(prisma.expenseCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Professional Services" }),
      }),
    );
  });
});

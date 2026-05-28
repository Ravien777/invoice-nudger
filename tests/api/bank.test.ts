import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth";
import { mockSession, mockUser, createNextRequest } from "../helpers";
import { POST as LinkTokenPOST } from "@/app/api/bank/link-token/route";
import { POST as ExchangeTokenPOST } from "@/app/api/bank/exchange-token/route";
import { POST as SyncPOST } from "@/app/api/bank/sync/route";
import { PUT as TransactionPUT } from "@/app/api/bank/transactions/[id]/route";
import { POST as ConfirmMatchPOST } from "@/app/api/bank/confirm-match/[transactionId]/route";

vi.mock("@/lib/bank-client", () => ({
  createLinkToken: vi.fn(),
  exchangePublicToken: vi.fn(),
  syncBankTransactions: vi.fn(),
}));

vi.mock("@/lib/reconciliation", () => ({
  createPaymentRecord: vi.fn(),
}));

vi.mock("@/lib/allocation", () => ({
  createAllocationRecord: vi.fn(),
}));

vi.mock("@/lib/integrations/crypto", () => ({
  encrypt: vi.fn((s: string) => `encrypted:${s}`),
  decrypt: vi.fn((s: string) => s.replace("encrypted:", "")),
}));

let prisma: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockReset();
  const setup = await import("../setup");
  prisma = setup.prisma;
});

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function txParams(transactionId: string) {
  return { params: Promise.resolve({ transactionId }) };
}

describe("POST /api/bank/link-token", () => {
  it("returns 401 without session", async () => {
    const res = await LinkTokenPOST();
    expect(res.status).toBe(401);
  });

  it("creates a link token", async () => {
    mockSession();
    mockUser();
    const { createLinkToken } = await import("@/lib/bank-client");
    vi.mocked(createLinkToken).mockResolvedValue("link-sandbox-abc123");

    const res = await LinkTokenPOST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.link_token).toBe("link-sandbox-abc123");
  });
});

describe("POST /api/bank/exchange-token", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/bank/exchange-token", {
      method: "POST",
      body: { publicToken: "public-sandbox-abc" },
    });
    const res = await ExchangeTokenPOST(req);
    expect(res.status).toBe(401);
  });

  it("exchanges token and creates connection", async () => {
    mockSession();
    mockUser();

    const { exchangePublicToken } = await import("@/lib/bank-client");
    vi.mocked(exchangePublicToken).mockResolvedValue({
      accessToken: "access-sandbox-abc",
      itemId: "item-1",
    });

    prisma.bankConnection.create.mockResolvedValue({
      id: "conn-1",
      institutionName: "Test Bank",
      accountMask: "1234",
    });

    const req = createNextRequest("http://localhost/api/bank/exchange-token", {
      method: "POST",
      body: {
        publicToken: "public-sandbox-abc",
        institutionName: "Test Bank",
        accountName: "Checking",
        accountMask: "1234",
      },
    });
    const res = await ExchangeTokenPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("conn-1");
  });

  it("returns 400 for missing publicToken", async () => {
    mockSession();
    mockUser();

    const req = createNextRequest("http://localhost/api/bank/exchange-token", {
      method: "POST",
      body: {},
    });
    const res = await ExchangeTokenPOST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bank/sync", () => {
  it("returns 401 without session", async () => {
    const res = await SyncPOST();
    expect(res.status).toBe(401);
  });

  it("returns 400 if no active connections", async () => {
    mockSession();
    mockUser();
    prisma.bankConnection.findMany.mockResolvedValue([]);

    const res = await SyncPOST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No active bank connections");
  });

  it("syncs active connections", async () => {
    mockSession();
    mockUser();
    prisma.bankConnection.findMany.mockResolvedValue([
      { id: "conn-1", userId: "user-1", status: "active" },
    ]);

    const { syncBankTransactions } = await import("@/lib/bank-client");
    vi.mocked(syncBankTransactions).mockResolvedValue({
      added: 5,
      modified: 2,
      removed: 0,
      errors: [],
    });
    prisma.syncLog.create.mockResolvedValue({} as any);

    const res = await SyncPOST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);
    expect(body.total).toBe(1);
  });
});

describe("PUT /api/bank/transactions/[id]", () => {
  it("returns 401 without session", async () => {
    const req = createNextRequest("http://localhost/api/bank/transactions/tx-1", {
      method: "PUT",
      body: { status: "ignored" },
    });
    const res = await TransactionPUT(req, params("tx-1"));
    expect(res.status).toBe(401);
  });

  it("updates transaction status", async () => {
    mockSession();
    mockUser();
    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: "tx-1",
      userId: "user-1",
    });
    prisma.bankTransaction.update.mockResolvedValue({
      id: "tx-1",
      status: "ignored",
    });

    const req = createNextRequest("http://localhost/api/bank/transactions/tx-1", {
      method: "PUT",
      body: { status: "ignored" },
    });
    const res = await TransactionPUT(req, params("tx-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction.status).toBe("ignored");
  });

  it("returns 404 for other user's transaction", async () => {
    mockSession();
    mockUser();
    prisma.bankTransaction.findFirst.mockResolvedValue(null);

    const req = createNextRequest("http://localhost/api/bank/transactions/tx-1", {
      method: "PUT",
      body: { status: "ignored" },
    });
    const res = await TransactionPUT(req, params("tx-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status", async () => {
    mockSession();
    mockUser();
    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: "tx-1",
      userId: "user-1",
    });

    const req = createNextRequest("http://localhost/api/bank/transactions/tx-1", {
      method: "PUT",
      body: { status: "invalid" },
    });
    const res = await TransactionPUT(req, params("tx-1"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bank/confirm-match/[transactionId]", () => {
  it("returns 401 without session", async () => {
    const res = await ConfirmMatchPOST(createNextRequest("http://localhost/api/bank/confirm-match/tx-1"), txParams("tx-1"));
    expect(res.status).toBe(401);
  });

  it("confirms match and marks invoice paid", async () => {
    mockSession();
    mockUser();

    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: "tx-1",
      userId: "user-1",
      amount: 500,
      currency: "USD",
      description: "ACME PAYMENT",
      matchedInvoiceId: "inv-1",
      status: "matched",
    });

    prisma.invoice.findUnique.mockResolvedValue({
      id: "inv-1",
      userId: "user-1",
      status: "unpaid",
      amount: 500,
      clientName: "Acme Corp",
    });

    prisma.invoice.update.mockResolvedValue({} as any);
    prisma.notification.create.mockResolvedValue({} as any);

    const res = await ConfirmMatchPOST(createNextRequest("http://localhost/api/bank/confirm-match/tx-1"), txParams("tx-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.invoiceId).toBe("inv-1");
  });

  it("returns 400 if no matched invoice", async () => {
    mockSession();
    mockUser();

    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: "tx-1",
      userId: "user-1",
      matchedInvoiceId: null,
      status: "unmatched",
    });

    const res = await ConfirmMatchPOST(createNextRequest("http://localhost/api/bank/confirm-match/tx-1"), txParams("tx-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 if invoice already paid", async () => {
    mockSession();
    mockUser();

    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: "tx-1",
      userId: "user-1",
      amount: 500,
      currency: "USD",
      description: "ACME PAYMENT",
      matchedInvoiceId: "inv-1",
      status: "matched",
    });

    prisma.invoice.findUnique.mockResolvedValue({
      id: "inv-1",
      status: "paid",
    });

    const res = await ConfirmMatchPOST(createNextRequest("http://localhost/api/bank/confirm-match/tx-1"), txParams("tx-1"));
    expect(res.status).toBe(400);
  });
});

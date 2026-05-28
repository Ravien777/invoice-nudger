import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../setup";
import {
  canCreateInvoice,
  canGenerateAI,
  canUseClientPortal,
  getMonthlyInvoiceCount,
  getAIMonthlyUsage,
} from "@/lib/subscriptions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    plan: "pro",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    aiTone: "professional",
    aiRemindersEnabled: true,
    portalBranding: null,
    portalEnabled: false,
    lateFeeEnabled: null,
    lateFeeType: null,
    lateFeeValue: null,
    lateFeeFrequency: null,
    interestEnabled: false,
    interestRate: null,
    lateFeeGraceDays: null,
    feeCap: null,
    lastPayYourselfDate: null,
    businessProfile: {
      id: "bp-1",
      userId: "test-user-id",
      taxRate: 30,
      fiscalYearStart: 1,
      taxSavingsAmount: 0,
      baseCurrency: "USD",
      defaultHourlyRate: null,
    },
    alertPreferences: null,
    industry: null,
    benchmarksOptOut: false,
    emailVerified: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
});

describe("getMonthlyInvoiceCount", () => {
  it("returns count of invoices in current month", async () => {
    vi.mocked(prisma.invoice.count).mockResolvedValue(3);
    const count = await getMonthlyInvoiceCount("user-1");
    expect(count).toBe(3);
    expect(prisma.invoice.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });
});

describe("canCreateInvoice", () => {
  it("returns allowed=true when under limit for pro", async () => {
    vi.mocked(prisma.invoice.count).mockResolvedValue(25);
    const result = await canCreateInvoice("user-1");
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(25);
    expect(result.limit).toBe(50);
  });

  it("returns allowed=false when at limit for pro", async () => {
    vi.mocked(prisma.invoice.count).mockResolvedValue(50);
    const result = await canCreateInvoice("user-1");
    expect(result.allowed).toBe(false);
  });

  it("returns allowed=true when over limit but limit is null (agency)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      email: "agency@example.com",
      name: "Agency User",
      plan: "agency",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      aiTone: "professional",
      aiRemindersEnabled: true,
      portalBranding: null,
      portalEnabled: false,
      lateFeeEnabled: null,
      lateFeeType: null,
      lateFeeValue: null,
      lateFeeFrequency: null,
      interestEnabled: false,
      interestRate: null,
      lateFeeGraceDays: null,
      feeCap: null,
      lastPayYourselfDate: null,
      businessProfile: {
        id: "bp-1",
        userId: "test-user-id",
        taxRate: 30,
        fiscalYearStart: 1,
        taxSavingsAmount: 0,
        baseCurrency: "USD",
        defaultHourlyRate: null,
      },
      alertPreferences: null,
      industry: null,
      benchmarksOptOut: false,
      emailVerified: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(999);
    const result = await canCreateInvoice("user-2");
    expect(result.allowed).toBe(true);
  });

  it("returns allowed=false for free tier at limit", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-3",
      email: "free@example.com",
      name: "Free User",
      plan: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      aiTone: "professional",
      aiRemindersEnabled: true,
      portalBranding: null,
      portalEnabled: false,
      lateFeeEnabled: null,
      lateFeeType: null,
      lateFeeValue: null,
      lateFeeFrequency: null,
      interestEnabled: false,
      interestRate: null,
      lateFeeGraceDays: null,
      feeCap: null,
      lastPayYourselfDate: null,
      businessProfile: {
        id: "bp-1",
        userId: "test-user-id",
        taxRate: 30,
        fiscalYearStart: 1,
        taxSavingsAmount: 0,
        baseCurrency: "USD",
        defaultHourlyRate: null,
      },
      alertPreferences: null,
      industry: null,
      benchmarksOptOut: false,
      emailVerified: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.mocked(prisma.invoice.count).mockResolvedValue(5);
    const result = await canCreateInvoice("user-3");
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(5);
  });
});

describe("canGenerateAI", () => {
  it("returns allowed=true when pro user under limit", async () => {
    vi.mocked(prisma.aIReminderUsage.findUnique).mockResolvedValue({
      count: 50,
    } as any);
    const result = await canGenerateAI("user-1");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(50);
  });

  it("returns allowed=false when pro user at limit", async () => {
    vi.mocked(prisma.aIReminderUsage.findUnique).mockResolvedValue({
      count: 100,
    } as any);
    const result = await canGenerateAI("user-1");
    expect(result.allowed).toBe(false);
  });

  it("returns allowed=true with used=0 when no usage record", async () => {
    vi.mocked(prisma.aIReminderUsage.findUnique).mockResolvedValue(null);
    const result = await canGenerateAI("user-1");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
  });
});

describe("canUseClientPortal", () => {
  it("returns false for free tier", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...vi.mocked(prisma.user.findUnique).mock.results[0]?.value,
      plan: "free",
    });
    const result = await canUseClientPortal("user-1");
    expect(result).toBe(false);
  });

  it("returns true for pro tier", async () => {
    const result = await canUseClientPortal("user-1");
    expect(result).toBe(true);
  });
});

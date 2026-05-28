import { vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

export const defaultUser = {
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
  lateFeeEnabled: true,
  lateFeeType: "fixed" as const,
  lateFeeValue: 10,
  lateFeeFrequency: "once" as const,
  interestEnabled: false,
  interestRate: null,
  lateFeeGraceDays: 3,
  feeCap: null,
  lastPayYourselfDate: null,
  alertPreferences: null,
  industry: null,
  benchmarksOptOut: false,
  emailVerified: null,
  image: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
  businessProfile: {
    id: "bp-1",
    userId: "user-1",
    taxRate: 0.30,
    fiscalYearStart: 1,
    taxSavingsAmount: 0,
    baseCurrency: "USD",
    defaultHourlyRate: null,
  },
};

export function mockSession(email = "test@example.com") {
  const mockGetSession = vi.mocked(getServerSession);
  mockGetSession.mockResolvedValue({ user: { email } } as any);
}

import { prisma } from "./setup";

export function mockUser(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    ...defaultUser,
    ...overrides,
  } as any);
}

export function createNextRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const { method = "GET", body, headers = {} } = options;
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", ...headers },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as any);
}

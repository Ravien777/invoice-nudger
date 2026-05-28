/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";
import { vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { mockDeep } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

vi.stubEnv("RESEND_API_KEY", "re_test_123");
vi.stubEnv("CRON_SECRET", "test-cron-secret");

const prisma = mockDeep<PrismaClient>();
vi.mock("@/lib/prisma", () => ({ prisma }));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/providers/email", () => ({
  default: vi.fn(() => ({ id: "email", name: "Email", type: "email" })),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({ url: "https://blob.vercel.test/receipt.jpg" }),
  del: vi.fn().mockResolvedValue(undefined),
}));

class MockResend {
  emails = { send: vi.fn().mockResolvedValue({}) };
}
vi.mock("resend", () => ({ Resend: MockResend }));

vi.mock("@/lib/expense-categories", () => ({
  seedDefaultExpenseCategories: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
});

export { prisma };

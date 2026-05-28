import { getServerSession } from "next-auth";
import { vi } from "vitest";

export function mockSession(overrides?: { email?: string }) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: overrides?.email ?? "test@example.com", name: "Test User", image: null },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

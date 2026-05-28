import { vi } from "vitest";

export function mockBlob() {
  vi.mock("@vercel/blob", () => ({
    put: vi.fn().mockResolvedValue({
      url: "https://public.blob.vercel-storage.com/receipts/test-123.jpg",
    }),
    del: vi.fn().mockResolvedValue(undefined),
  }));
}

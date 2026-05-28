// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Providers } from "@/app/providers";

vi.mock("@/lib/pwa-register", () => ({
  registerServiceWorker: vi.fn(),
}));

import { registerServiceWorker } from "@/lib/pwa-register";

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-hot-toast", () => ({
  Toaster: () => null,
}));

describe("Providers", () => {
  beforeEach(() => {
    registerServiceWorker.mockClear();
  });

  it("calls registerServiceWorker on mount", () => {
    render(<Providers><div>child</div></Providers>);
    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
  });

  it("renders children inside the provider", () => {
    const { getByText } = render(<Providers><span>hello</span></Providers>);
    expect(getByText("hello")).toBeInTheDocument();
  });
});

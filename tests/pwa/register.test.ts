// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { registerServiceWorker } from "@/lib/pwa-register";

describe("registerServiceWorker", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("registers sw.js in production", () => {
    process.env.NODE_ENV = "production";
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
    const addEventListener = vi.spyOn(window, "addEventListener");

    registerServiceWorker();

    expect(addEventListener).toHaveBeenCalledWith("load", expect.any(Function));
    addEventListener.mock.calls[0][1]();
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });

  it("does not register in development", () => {
    process.env.NODE_ENV = "development";
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
      writable: true,
    });

    registerServiceWorker();

    expect(register).not.toHaveBeenCalled();
  });

  it("does not throw when serviceWorker is unavailable", () => {
    process.env.NODE_ENV = "production";
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => registerServiceWorker()).not.toThrow();
  });
});

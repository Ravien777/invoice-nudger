import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const swPath = path.resolve("public/sw.js");
const swContent = readFileSync(swPath, "utf-8");

describe("public/sw.js", () => {
  it("exists and has content", () => {
    expect(swContent.length).toBeGreaterThan(100);
  });

  it("listens for install event", () => {
    expect(swContent).toContain("addEventListener(\"install\"");
  });

  it("listens for activate event", () => {
    expect(swContent).toContain("addEventListener(\"activate\"");
  });

  it("listens for fetch event", () => {
    expect(swContent).toContain("addEventListener(\"fetch\"");
  });

  it("calls skipWaiting", () => {
    expect(swContent).toContain("skipWaiting");
  });

  it("calls clients.claim", () => {
    expect(swContent).toContain("clients.claim");
  });

  it("has a cache name", () => {
    expect(swContent).toMatch(/CACHE\s*=\s*"/);
  });

  it("has at least one static asset to cache", () => {
    expect(swContent).toContain("/manifest.json");
  });

  it("responds with cache-first strategy", () => {
    expect(swContent).toContain("caches.match(event.request)");
  });
});

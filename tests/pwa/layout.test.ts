import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const layoutPath = path.resolve("app/layout.tsx");
const layoutContent = readFileSync(layoutPath, "utf-8");

describe("app/layout.tsx", () => {
  it("exports viewport metadata", () => {
    expect(layoutContent).toMatch(
      /export\s+(const\s+viewport|const\s+viewport\s*=|let\s+viewport)/,
    );
  });

  it("sets themeColor in viewport", () => {
    expect(layoutContent).toContain("themeColor");
  });

  it("includes apple-touch-icon link", () => {
    expect(layoutContent).toContain("apple-touch-icon");
  });

  it("includes icon link tag", () => {
    expect(layoutContent).toContain('rel="icon"');
  });

  it("does NOT contain manual theme-color meta tag", () => {
    // The viewport export replaces manual <meta name="theme-color">
    expect(layoutContent).not.toContain('name="theme-color"');
  });
});

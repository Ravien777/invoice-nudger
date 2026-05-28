import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const manifestPath = path.resolve("public/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

describe("public/manifest.json", () => {
  it("has required PWA fields", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
  });

  it("has a theme_color", () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has at least one icon with PNG type", () => {
    const pngIcons = manifest.icons.filter(
      (icon: { type: string }) => icon.type === "image/png",
    );
    expect(pngIcons.length).toBeGreaterThanOrEqual(2);

    const sizes = pngIcons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("has SVG icons for maskable purpose", () => {
    const maskable = manifest.icons.filter(
      (icon: { purpose?: string }) => icon.purpose && icon.purpose.includes("maskable"),
    );
    expect(maskable.length).toBeGreaterThanOrEqual(1);
  });

  it("does not set prefer_related_applications to true", () => {
    expect(manifest.prefer_related_applications).not.toBe(true);
  });
});

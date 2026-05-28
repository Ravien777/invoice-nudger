import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateReceiptFile } from "@/lib/storage";

function createMockFile(name: string, type: string, size: number): File {
  const blob = new Blob([new ArrayBuffer(size)], { type });
  return new File([blob], name, { type });
}

describe("validateReceiptFile", () => {
  it("returns null for valid JPEG", () => {
    const file = createMockFile("receipt.jpg", "image/jpeg", 1024 * 1024);
    expect(validateReceiptFile(file)).toBeNull();
  });

  it("returns null for valid PNG", () => {
    const file = createMockFile("receipt.png", "image/png", 1024 * 1024);
    expect(validateReceiptFile(file)).toBeNull();
  });

  it("returns null for valid PDF", () => {
    const file = createMockFile("receipt.pdf", "application/pdf", 1024 * 1024);
    expect(validateReceiptFile(file)).toBeNull();
  });

  it("returns null for valid WebP", () => {
    const file = createMockFile("receipt.webp", "image/webp", 1024 * 1024);
    expect(validateReceiptFile(file)).toBeNull();
  });

  it("returns error for unsupported file type", () => {
    const file = createMockFile("receipt.gif", "image/gif", 1024 * 1024);
    expect(validateReceiptFile(file)).toBe("Only JPEG, PNG, WebP, and PDF files are allowed");
  });

  it("returns error for SVG", () => {
    const file = createMockFile("receipt.svg", "image/svg+xml", 1024);
    expect(validateReceiptFile(file)).toBe("Only JPEG, PNG, WebP, and PDF files are allowed");
  });

  it("returns error for file exceeding 10 MB", () => {
    const file = createMockFile("large.jpg", "image/jpeg", 11 * 1024 * 1024);
    expect(validateReceiptFile(file)).toBe("File size must be under 10 MB");
  });

  it("returns error for exactly 10 MB (boundary)", () => {
    const file = createMockFile("exact.jpg", "image/jpeg", 10 * 1024 * 1024);
    expect(validateReceiptFile(file)).toBeNull();
  });

  it("returns error for 0 byte file", () => {
    const file = createMockFile("empty.jpg", "image/jpeg", 0);
    expect(validateReceiptFile(file)).toBeNull();
  });

  it("returns error for large PDF", () => {
    const file = createMockFile("big.pdf", "application/pdf", 15 * 1024 * 1024);
    expect(validateReceiptFile(file)).toBe("File size must be under 10 MB");
  });
});

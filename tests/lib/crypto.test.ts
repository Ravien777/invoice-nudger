import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/lib/integrations/crypto";

beforeAll(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = "a".repeat(64);
});

describe("encrypt / decrypt", () => {
  it("encrypts and decrypts a string", () => {
    const original = "hello-world";
    const decrypted = decrypt(encrypt(original));
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext for the same input", () => {
    const input = "test-value";
    const a = encrypt(input);
    const b = encrypt(input);
    expect(a).not.toBe(b);
  });

  it("round-trips special characters", () => {
    const input = "password!@#$%^&*()_+{}:<>?";
    expect(decrypt(encrypt(input))).toBe(input);
  });

  it("round-trips long text", () => {
    const input = "a".repeat(1000);
    expect(decrypt(encrypt(input))).toBe(input);
  });

  it("round-trips OAuth tokens", () => {
    const token = "ya29.a0AfH6SMD...long-oauth-token...xyz";
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it("produces format: iv:authTag:ciphertext", () => {
    const encrypted = encrypt("any-value");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("throws on invalid encrypted data", () => {
    expect(() => decrypt("invalid")).toThrow("Invalid encrypted data format");
  });
});

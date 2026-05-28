import { describe, it, expect } from "vitest";
import { getTier, TIERS } from "@/lib/tiers";

describe("getTier", () => {
  it("returns free tier config", () => {
    const tier = getTier("free");
    expect(tier.invoiceLimit).toBe(5);
    expect(tier.name).toBe("Free");
  });

  it("returns pro tier config", () => {
    const tier = getTier("pro");
    expect(tier.invoiceLimit).toBe(50);
    expect(tier.priceCents).toBe(999);
  });

  it("returns agency tier config", () => {
    const tier = getTier("agency");
    expect(tier.name).toBe("Agency");
    expect(tier.invoiceLimit).toBeNull();
  });

  it("returns free tier for unknown plan", () => {
    const tier = getTier("enterprise");
    expect(tier.invoiceLimit).toBe(5);
    expect(tier.name).toBe("Free");
  });

  it("returns free tier for empty string", () => {
    const tier = getTier("");
    expect(tier.invoiceLimit).toBe(5);
  });

  it("returns free tier for nullish value", () => {
    const tier = getTier(null as unknown as string);
    expect(tier.invoiceLimit).toBe(5);
  });
});

describe("TIERS", () => {
  it("has free, pro, and agency tiers", () => {
    expect(TIERS).toHaveProperty("free");
    expect(TIERS).toHaveProperty("pro");
    expect(TIERS).toHaveProperty("agency");
  });

  it("free tier has correct limits", () => {
    expect(TIERS.free).toMatchObject({
      name: "Free",
      invoiceLimit: 5,
      priceCents: 0,
      clientPortal: false,
      lateFees: false,
    });
  });

  it("pro tier has client portal and late fees", () => {
    expect(TIERS.pro.clientPortal).toBe(true);
    expect(TIERS.pro.lateFees).toBe(true);
  });

  it("agency tier has null invoice limit (unlimited)", () => {
    expect(TIERS.agency.invoiceLimit).toBeNull();
    expect(TIERS.agency.clientPortal).toBe(true);
  });

  it("each tier has all required keys", () => {
    const keys: (keyof typeof TIERS.free)[] = [
      "name", "invoiceLimit", "priceCents", "aiRemindersLimit",
      "clientPortal", "lateFees", "smsLimit", "whatsappLimit", "features",
    ];
    for (const tier of Object.values(TIERS)) {
      for (const key of keys) {
        expect(tier).toHaveProperty(key);
      }
    }
  });
});

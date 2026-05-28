import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyCompact,
  currencySymbol,
  currenciesWithSymbol,
  SUPPORTED_CURRENCIES,
} from "@/lib/format-currency";

describe("currencySymbol", () => {
  it("returns $ for USD", () => {
    expect(currencySymbol("USD")).toBe("$");
  });

  it("returns € for EUR", () => {
    expect(currencySymbol("EUR")).toBe("€");
  });

  it("returns input for unknown currency", () => {
    expect(currencySymbol("XYZ")).toBe("XYZ");
  });

  it("is case-sensitive", () => {
    expect(currencySymbol("usd")).toBe("usd");
  });

  it("returns correct symbol for all supported currencies", () => {
    const symbols: Record<string, string> = {
      USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$",
      SGD: "S$", ZAR: "R", INR: "₹", NZD: "NZ$", CHF: "Fr",
      JPY: "¥", BRL: "R$", MXN: "MX$", SRD: "SR$",
    };
    for (const [code, expected] of Object.entries(symbols)) {
      expect(currencySymbol(code)).toBe(expected);
    }
  });
});

describe("formatCurrency", () => {
  it("formats USD with $ prefix and 2 decimals", () => {
    expect(formatCurrency(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats EUR with € prefix", () => {
    expect(formatCurrency(99.99, "EUR")).toBe("€99.99");
  });

  it("formats JPY with ¥ prefix and 2 decimals by default", () => {
    expect(formatCurrency(500, "JPY")).toBe("¥500.00");
  });

  it("formats SRD with SRD prefix", () => {
    const result = formatCurrency(1000, "SRD");
    expect(result).toContain("SRD");
    expect(result).toContain("1,000.00");
  });

  it("defaults to USD when no currency given", () => {
    expect(formatCurrency(100)).toBe("$100.00");
  });

  it("handles zero", () => {
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });

  it("handles negative amounts", () => {
    expect(formatCurrency(-50, "USD")).toBe("-$50.00");
  });

  it("handles large numbers with grouping", () => {
    expect(formatCurrency(1000000, "USD")).toBe("$1,000,000.00");
  });

  it("respects custom fraction digits", () => {
    expect(formatCurrency(10.5, "USD", { minimumFractionDigits: 0 })).toBe("$10.5");
    const compact = formatCurrency(10, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    expect(compact).toBe("$10");
  });
});

describe("formatCurrencyCompact", () => {
  it("returns $1,000 for 1000", () => {
    expect(formatCurrencyCompact(1000, "USD")).toBe("$1,000");
  });

  it("returns $1,000,000 for 1000000", () => {
    expect(formatCurrencyCompact(1000000, "USD")).toBe("$1,000,000");
  });

  it("returns $500 for 500", () => {
    expect(formatCurrencyCompact(500, "USD")).toBe("$500");
  });

  it("defaults to USD", () => {
    expect(formatCurrencyCompact(1000)).toBe("$1,000");
  });
});

describe("currenciesWithSymbol", () => {
  it("returns all supported currencies", () => {
    const result = currenciesWithSymbol();
    expect(result).toHaveLength(SUPPORTED_CURRENCIES.length);
  });

  it("each entry has code, label, and symbol", () => {
    for (const c of currenciesWithSymbol()) {
      expect(c).toHaveProperty("code");
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("symbol");
    }
  });

  it("USD entry has correct shape", () => {
    const usd = currenciesWithSymbol().find((c) => c.code === "USD");
    expect(usd).toMatchObject({ code: "USD", symbol: "$" });
  });

  it("SRD is included", () => {
    const srd = currenciesWithSymbol().find((c) => c.code === "SRD");
    expect(srd).toBeDefined();
  });

  it("CHF uses Fr as symbol", () => {
    const chf = currenciesWithSymbol().find((c) => c.code === "CHF");
    expect(chf?.symbol).toBe("Fr");
  });
});

describe("SUPPORTED_CURRENCIES", () => {
  it("contains 14 currencies", () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(14);
  });

  it("includes SRD", () => {
    expect(SUPPORTED_CURRENCIES).toContain("SRD");
  });
});

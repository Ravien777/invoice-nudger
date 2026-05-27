export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "ZAR", "INR", "NZD", "CHF", "JPY", "BRL", "MXN", "SRD",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  ZAR: "R",
  INR: "₹",
  NZD: "NZ$",
  CHF: "Fr",
  JPY: "¥",
  BRL: "R$",
  MXN: "MX$",
  SRD: "SR$",
};

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] || currency;
}

export function formatCurrency(
  amount: number,
  currency: string = "USD",
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(amount);
}

export function formatCurrencyCompact(
  amount: number,
  currency: string = "USD",
): string {
  return formatCurrency(amount, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function currenciesWithSymbol(): { code: string; label: string; symbol: string }[] {
  return SUPPORTED_CURRENCIES.map((code) => ({
    code,
    label: `${code} (${SYMBOLS[code] || code})`,
    symbol: SYMBOLS[code] || code,
  }));
}

export interface ReceiptParseResult {
  amount: number | null;
  currency: string;
  vendor: string | null;
  date: string | null;
  description: string;
  confidence: "high" | "medium" | "low";
  rawText: string;
}

const CURRENCY_PATTERNS: Record<string, { symbol: string; regex: RegExp }> = {
  USD: { symbol: "$", regex: /\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/g },
  EUR: { symbol: "€", regex: /€\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/g },
  GBP: { symbol: "£", regex: /£\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/g },
};

const VENDOR_PATTERNS = [
  /(?:from|at|by)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s+on|\s+for|\s+to|\s+during|\.|,|!|\n|$)/i,
  /(?:receipt|invoice|order|purchase)\s+(?:from|by)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\.|,|!|\n|$)/i,
  /(?:thank\s+you\s+for\s+(?:your\s+)?(?:purchase|order|payment|business)\s+(?:at|from|with)\s+)([A-Z][A-Za-z0-9\s&.]+?)(?:\.|,|!|\n|$)/i,
];

const DATE_PATTERNS = [
  /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
  /(\d{4})-(\d{1,2})-(\d{1,2})/,
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
  /(\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
];

function detectCurrency(text: string): string {
  for (const [code, { symbol }] of Object.entries(CURRENCY_PATTERNS)) {
    if (text.includes(symbol)) return code;
  }
  return "USD";
}

function extractAmount(text: string, currency: string): number | null {
  const patterns = CURRENCY_PATTERNS[currency] ?? CURRENCY_PATTERNS.USD;
  const matches = Array.from(text.matchAll(patterns.regex));
  if (matches.length === 0) return null;

  const amounts = matches
    .map((m) => parseFloat(m[1].replace(/,/g, "")))
    .filter((n) => n > 0 && n < 100000);
  if (amounts.length === 0) return null;

  return Math.max(...amounts);
}

function extractVendor(text: string): string | null {
  for (const pattern of VENDOR_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    try {
      let d: Date | null = null;
      if (pattern === DATE_PATTERNS[0]) {
        const [, m, day, y] = match;
        const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
        d = new Date(year, parseInt(m) - 1, parseInt(day));
      } else if (pattern === DATE_PATTERNS[1]) {
        const [, y, m, day] = match;
        d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
      } else if (pattern === DATE_PATTERNS[2]) {
        const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const monthStr = match[0].match(/[A-Za-z]+/)?.[0]?.toLowerCase().slice(0, 3) ?? "";
        const month = months[monthStr];
        d = new Date(parseInt(match[2]), month, parseInt(match[1]));
      } else if (pattern === DATE_PATTERNS[3]) {
        const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const monthStr = match[0].match(/[A-Za-z]+/)?.[0]?.toLowerCase().slice(0, 3) ?? "";
        const month = months[monthStr];
        d = new Date(parseInt(match[2]), month, parseInt(match[1]));
      }
      if (d && !isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    } catch {
      continue;
    }
  }
  return null;
}

function cleanText(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildDescription(vendor: string | null, subject: string, fallback: string): string {
  if (vendor) return vendor;
  const cleaned = subject.replace(/^(?:Fwd|FW|Re|RE):\s*/i, "").trim();
  if (cleaned && cleaned.length > 10) return cleaned;
  return fallback;
}

export async function parseReceiptEmail(payload: {
  subject: string;
  text: string;
  html?: string | null;
  from: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType: string }>;
}): Promise<ReceiptParseResult> {
  const subject = (payload.subject ?? "").trim();
  const textBody = cleanText(payload.text ?? cleanText(payload.html ?? ""));
  const searchText = `${subject}\n${textBody}`;

  let attachmentText = "";
  if (payload.attachments && payload.attachments.length > 0) {
    for (const att of payload.attachments) {
      if (att.contentType === "application/pdf" || att.filename?.endsWith(".pdf")) {
        try {
          const { PDFParse } = await import("pdf-parse");
          const buf = typeof att.content === "string" ? Buffer.from(att.content, "base64") : att.content;
          const pdf = new PDFParse({ data: buf });
          const textResult = await pdf.getText();
          attachmentText += " " + textResult.text;
          await pdf.destroy();
        } catch {
          // PDF parse failed, skip
        }
      }
    }
  }

  const fullText = searchText + " " + attachmentText;
  const currency = detectCurrency(fullText);
  const amount = extractAmount(fullText, currency);
  const vendor = extractVendor(fullText);
  const date = extractDate(fullText);
  const description = buildDescription(vendor, subject, `Receipt from ${payload.from}`);

  let confidence: "high" | "medium" | "low";
  if (amount !== null && vendor !== null && date !== null) {
    confidence = "high";
  } else if (amount !== null) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return { amount, currency, vendor, date, description, confidence, rawText: fullText.slice(0, 2000) };
}

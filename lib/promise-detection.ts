import OpenAI from "openai";

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

interface InvoiceContext {
  clientName: string;
  projectName: string | null;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
}

interface PromiseClassification {
  isPromise: boolean;
  promisedDate: Date | null;
  confidence: number;
  reasoning: string;
}

function buildPrompt(emailContent: string, context: InvoiceContext): string {
  const formattedDate = context.dueDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `You are analyzing an email reply from a client regarding an unpaid invoice. Determine if the email contains a payment promise and extract the promised payment date.

Invoice Context:
- Client: ${context.clientName}
- Invoice: ${context.invoiceNumber ?? "N/A"}
- Amount: ${new Intl.NumberFormat("en-US", { style: "currency", currency: context.currency }).format(context.amount)}
- Due Date: ${formattedDate}
- Today: ${today}

Email Content:
---
${emailContent}
---

Analyze the email and return a JSON object with:
- isPromise: true if the email contains a commitment or promise to pay
- promisedDate: the date they promised to pay (ISO format YYYY-MM-DD), or null if no specific date
- confidence: a number between 0 and 1 indicating your confidence
- reasoning: a brief explanation of your analysis

Rules for date extraction:
- Parse relative dates like "next Friday", "tomorrow", "end of month", "by Monday" relative to today (${today})
- If they say "this week", use Friday of this week
- If they say "end of month", use the last day of the current month
- If they say "ASAP" or "soon" without a date, set promisedDate to 7 days from today
- If no date can be inferred, set promisedDate to null

Return ONLY valid JSON, no other text.`;
}

function parseResponse(response: string): PromiseClassification {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isPromise: false, promisedDate: null, confidence: 0, reasoning: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    let promisedDate: Date | null = null;
    if (parsed.promisedDate) {
      promisedDate = new Date(parsed.promisedDate);
      if (isNaN(promisedDate.getTime())) {
        promisedDate = null;
      }
    }

    return {
      isPromise: Boolean(parsed.isPromise),
      promisedDate,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch {
    return { isPromise: false, promisedDate: null, confidence: 0, reasoning: "Failed to parse AI response" };
  }
}

export async function classifyPaymentPromise(emailContent: string, context: InvoiceContext): Promise<PromiseClassification> {
  const prompt = buildPrompt(emailContent, context);

  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are an expert at analyzing payment-related emails. You always return valid JSON with your analysis.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 512,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content ?? "";
  return parseResponse(content);
}

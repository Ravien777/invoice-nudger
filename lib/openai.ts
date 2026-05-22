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

export type Tone = "professional" | "friendly" | "firm" | "casual";

interface GenerateParams {
  clientName: string;
  projectName: string | null;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  daysOffset: number;
  tone: Tone;
  paymentLink: string;
}

interface GeneratedEmail {
  subject: string;
  html: string;
}

function buildPrompt(params: GenerateParams): string {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: params.currency,
  }).format(params.amount);

  const formattedDate = params.dueDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const daysOverdue = -params.daysOffset;
  let timingContext: string;
  if (daysOverdue < 0) {
    timingContext = `The invoice is due in ${Math.abs(daysOverdue)} day(s) (due: ${formattedDate}).`;
  } else if (daysOverdue === 0) {
    timingContext = `The invoice is due TODAY (${formattedDate}).`;
  } else {
    timingContext = `The invoice is ${daysOverdue} day(s) overdue (was due: ${formattedDate}).`;
  }

  const projectContext = params.projectName
    ? `The invoice is for the project "${params.projectName}". Reference this naturally in the email.`
    : "No specific project name is available.";

  const toneDescriptions: Record<Tone, string> = {
    professional: "Maintain a formal, respectful, and business-appropriate tone.",
    friendly: "Use a warm, conversational tone while remaining professional.",
    firm: "Be direct and assertive. Emphasize urgency without being aggressive.",
    casual: "Use a relaxed, conversational tone as if writing to a colleague.",
  };

  return `You are writing a payment reminder email on behalf of a business owner to their client.

Context:
- Client name: ${params.clientName}
- ${projectContext}
- Invoice number: ${params.invoiceNumber ?? "N/A"}
- Amount: ${formattedAmount}
- ${timingContext}
- Tone: ${toneDescriptions[params.tone]}

Write a concise, professional payment reminder email. Return ONLY valid HTML content (no <html>, <head>, or <body> tags). Use inline styles. Include a clear call-to-action button linking to the payment link below.

Rules:
- Keep it under 150 words
- Reference the project name naturally if available
- Match the specified tone
- Do not include placeholders or meta-commentary
- Use a <div> wrapper with system-ui font family

Payment link: ${params.paymentLink}

Return the email as HTML with a subject line in the format:
SUBJECT: <subject text>
BODY: <html content>`;
}

function parseResponse(response: string): GeneratedEmail {
  const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
  const bodyMatch = response.match(/BODY:\s*([\s\S]+)$/i);

  const subject = subjectMatch
    ? subjectMatch[1].trim()
    : "Payment Reminder";

  let html = bodyMatch
    ? bodyMatch[1].trim()
    : response;

  if (!html.startsWith("<")) {
    html = `<div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;"><p>${html}</p></div>`;
  }

  return { subject, html };
}

export async function generateReminderCopy(params: GenerateParams): Promise<GeneratedEmail> {
  const prompt = buildPrompt(params);

  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an expert at writing payment reminder emails. You always return well-formatted HTML with a clear subject line.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content ?? "";
  return parseResponse(content);
}

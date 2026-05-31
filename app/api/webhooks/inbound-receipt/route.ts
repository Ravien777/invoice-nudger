import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseReceiptAddress } from "@/lib/assign-receipt-emails";
import { parseReceiptEmail } from "@/lib/receipt-parser";
import crypto from "crypto";

const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

function verifyMailgunSignature(timestamp: string, token: string, signature: string): boolean {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) return true;

  const hmac = crypto.createHmac("sha256", MAILGUN_WEBHOOK_SIGNING_KEY);
  hmac.update(`${timestamp}${token}`);
  const expectedSignature = hmac.digest("hex");

  return signature === expectedSignature;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const timestamp = formData.get("timestamp") as string;
  const token = formData.get("token") as string;
  const signature = formData.get("signature") as string;
  const from = formData.get("from") as string;
  const to = formData.get("To") as string;
  const subject = formData.get("subject") as string;
  const bodyPlain = formData.get("body-plain") as string;
  const bodyHtml = formData.get("body-html") as string;
  const attachments: Array<File> = [];
  for (const key of formData.keys()) {
    if (key === "attachment" || /^attachment-\d+$/.test(key)) {
      const files = formData.getAll(key);
      attachments.push(...(files as Array<File>));
    }
  }

  if (!verifyMailgunSignature(timestamp, token, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!to) {
    return NextResponse.json({ status: "ignored", reason: "No recipient address" });
  }

  const parsed = parseReceiptAddress(to);
  if (!parsed) {
    return NextResponse.json({ status: "ignored", reason: "Not a receipt address" });
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    include: { expenseCategories: { take: 1, where: { name: "Other" } } },
  });
  if (!user) {
    return NextResponse.json({ status: "ignored", reason: "User not found" });
  }

  const parsedAttachments = await Promise.all(
    Array.from(attachments).map(async (file) => ({
      filename: file.name,
      contentType: file.type,
      content: Buffer.from(await file.arrayBuffer()),
    })),
  );

  const parseResult = await parseReceiptEmail({
    subject: subject ?? "",
    text: bodyPlain ?? "",
    html: bodyHtml ?? null,
    from: from ?? "",
    attachments: parsedAttachments,
  });

  const defaultCategoryId = user.expenseCategories[0]?.id ?? null;

  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      description: parseResult.description,
      amount: parseResult.amount ?? 0,
      currency: parseResult.currency,
      date: parseResult.date ? new Date(parseResult.date) : new Date(),
      vendor: parseResult.vendor,
      notes: `Imported from email receipt. Sender: ${from}. Subject: ${subject}.${parseResult.confidence === "low" ? " Could not extract amount automatically." : ""}`,
      categoryId: defaultCategoryId,
      status: parseResult.confidence === "high" ? "confirmed" : "draft",
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "receipt_imported",
      title: parseResult.confidence === "high" ? "Receipt logged" : "Receipt received — needs review",
      message: `Receipt from ${from} has been logged as an expense${parseResult.confidence === "high" ? "." : ". We could not read the amount — please check it in Expenses."}`,
      metadata: { expenseId: expense.id, confidence: parseResult.confidence },
    },
  });

  return NextResponse.json({
    status: "processed",
    expenseId: expense.id,
    confidence: parseResult.confidence,
  });
}

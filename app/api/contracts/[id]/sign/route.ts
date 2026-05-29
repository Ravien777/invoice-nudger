import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Resend } from "resend";
import { generateContractPdf } from "@/lib/contract-pdf";
import { uploadPdf } from "@/lib/storage";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

const signSchema = z.object({
  token: z.string(),
  signedByName: z.string().min(1, "Full name is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = signSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, signedByName } = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.signingToken !== token) {
    return NextResponse.json({ error: "Invalid signing token" }, { status: 403 });
  }

  if (contract.status !== "sent") {
    if (contract.status === "signed") {
      return NextResponse.json({ error: "Contract has already been signed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Contract is not available for signing" }, { status: 400 });
  }

  if (contract.expiresAt && contract.expiresAt < new Date()) {
    return NextResponse.json({ error: "Contract has expired" }, { status: 400 });
  }

  const signedByIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const signedAt = new Date();

  let pdfUrl: string | null = null;

  try {
    const pdfBuffer = await generateContractPdf({
      title: contract.title,
      body: contract.body,
      signedByName,
      signedAt,
      signedByIp,
      clientName: contract.clientName,
    });

    pdfUrl = await uploadPdf(pdfBuffer, contract.userId);
  } catch (pdfError) {
    console.error("PDF generation or upload failed:", pdfError);
  }

  await prisma.contract.update({
    where: { id },
    data: {
      status: "signed",
      signedAt,
      signedByName,
      signedByIp,
      pdfUrl,
    },
  });

  if (contract.quoteId) {
    await prisma.quote.update({
      where: { id: contract.quoteId },
      data: { status: "accepted" },
    });
  }

  const ownerEmail = contract.user.email;
  const ownerName = contract.user.name ?? "Your client";

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
      to: contract.clientEmail,
      subject: `Contract signed: ${contract.title}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Contract Signed ✓</h2>
          <p>You have signed "${contract.title}" with ${ownerName}.</p>
          <p style="color: #666; font-size: 13px;">A copy has been sent to both parties.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send client confirmation email:", e);
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
      to: ownerEmail,
      subject: `${contract.clientName} signed your contract`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Contract Signed ✓</h2>
          <p>${contract.clientName} has signed "${contract.title}".</p>
          <p style="color: #666; font-size: 13px;">Signed by: ${signedByName} on ${signedAt.toLocaleDateString("en-US")}</p>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send owner notification email:", e);
  }

  await prisma.notification.create({
    data: {
      userId: contract.userId,
      type: "contract_signed",
      title: "Contract signed",
      message: `${contract.clientName} signed "${contract.title}".`,
      metadata: { contractId: contract.id, signedByName, signedAt: signedAt.toISOString() },
    },
  });

  return NextResponse.json({ status: "signed", signedAt, pdfUrl });
}

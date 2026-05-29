import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, userId: user.id },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Contract has already been sent" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const signingUrl = `${baseUrl}/sign/${contract.signingToken}`;

  const { error: emailError } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
    to: contract.clientEmail,
    subject: `Contract for review: ${contract.title}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Hello ${contract.clientName},</h2>
        <p>${user.name ?? "Your service provider"} has sent you a contract titled <strong>"${contract.title}"</strong> for review.</p>
        <p style="margin: 24px 0;">
          <a href="${signingUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
            Review & Sign Contract
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">This link is unique to you. Do not share it with anyone else.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Sent via Maroni</p>
      </div>
    `,
  });

  if (emailError) {
    console.error("Failed to send contract email:", emailError);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  await prisma.contract.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "contract_sent",
      title: "Contract sent",
      message: `Contract "${contract.title}" sent to ${contract.clientName} (${contract.clientEmail}).`,
      metadata: { contractId: contract.id, clientEmail: contract.clientEmail },
    },
  });

  return NextResponse.json({ signingUrl, status: "sent" });
}

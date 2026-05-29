import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { Resend } from "resend";
import { z } from "zod";
import { generatePayslipPdf } from "@/lib/payslip-pdf";
import { payslipEmail } from "@/lib/email-templates/payslip";
import { formatCurrency } from "@/lib/format-currency";

const resend = new Resend(process.env.RESEND_API_KEY || "re_");

const paySchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  description: z.string().min(1),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paymentDate must be YYYY-MM-DD"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: contractorId } = await params;

  const contractor = await prisma.contractor.findFirst({
    where: { id: contractorId, userId: user.id },
  });

  if (!contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { amount, currency, description, paymentDate } = parsed.data;

  // Find or create "Professional Services" category
  let category = await prisma.expenseCategory.findFirst({
    where: { userId: user.id, name: "Professional Services" },
  });

  if (!category) {
    category = await prisma.expenseCategory.create({
      data: { userId: user.id, name: "Professional Services", isDefault: true },
    });
  }

  const payment = await prisma.contractorPayment.create({
    data: {
      userId: user.id,
      contractorId,
      amount,
      currency,
      description,
      paymentDate: new Date(paymentDate),
    },
  });

  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      description: `Payment to ${contractor.name}: ${description}`,
      amount,
      currency,
      date: new Date(paymentDate),
      vendor: contractor.name,
      taxDeductible: true,
    },
  });

  // Link expense to payment
  await prisma.contractorPayment.update({
    where: { id: payment.id },
    data: { expenseId: expense.id },
  });

  // Generate payslip PDF
  const businessProfile = user.businessProfile;
  const pdfBuffer = await generatePayslipPdf({
    businessName: businessProfile?.businessName ?? "Your Business",
    businessAddress: businessProfile?.businessAddress ?? "Your Business Address",
    contractorName: contractor.name,
    contractorEmail: contractor.email,
    contractorTaxId: contractor.taxId,
    amount,
    currency,
    description,
    paymentDate: new Date(paymentDate),
  });

  // Upload to Vercel Blob
  const blob = await put(
    `payslips/${user.id}/${payment.id}.pdf`,
    pdfBuffer,
    { access: "public", addRandomSuffix: false, contentType: "application/pdf" },
  );

  // Update payment with payslip URL
  await prisma.contractorPayment.update({
    where: { id: payment.id },
    data: { payslipUrl: blob.url },
  });

  // Send email to contractor
  const businessName = businessProfile?.businessName ?? "Your Business";
  const { subject, html } = payslipEmail({
    businessName,
    contractorName: contractor.name,
    description,
    amount: formatCurrency(amount, currency),
  });

  await resend.emails.send({
    from: "Maroni <noreply@maroni.app>",
    to: contractor.email,
    subject,
    html,
    attachments: [
      {
        filename: `payslip-${payment.id}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  return NextResponse.json({
    paymentId: payment.id,
    payslipUrl: blob.url,
    expenseId: expense.id,
  });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validations";

interface CSVRow {
  clientName: string;
  clientEmail: string;
  amount: string | number;
  dueDate: string;
  invoiceNumber?: string;
  notes?: string;
  currency?: string;
}

interface UploadError {
  row: number;
  data: Record<string, unknown>;
  reason: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const rows: CSVRow[] = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "No rows provided" },
      { status: 400 }
    );
  }

  if (rows.length > 500) {
    return NextResponse.json(
      { error: "Maximum 500 rows per upload" },
      { status: 400 }
    );
  }

  const errors: UploadError[] = [];
  const validInvoices: Array<{
    clientName: string;
    clientEmail: string;
    amount: number;
    currency: string;
    dueDate: Date;
    invoiceNumber: string | null;
    notes: string | null;
    userId: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = invoiceSchema.safeParse(row);

    if (!validation.success) {
      const messages = validation.error.issues.map((e: { message: string }) => e.message).join(", ");
      errors.push({
        row: i + 1,
        data: row as unknown as Record<string, unknown>,
        reason: messages,
      });
      continue;
    }

    const { clientName, clientEmail, amount, currency, dueDate, invoiceNumber, notes } =
      validation.data;

    validInvoices.push({
      clientName,
      clientEmail,
      amount,
      currency: currency || "USD",
      dueDate: new Date(dueDate),
      invoiceNumber: invoiceNumber || null,
      notes: notes || null,
      userId: user.id,
    });
  }

  const created = await prisma.invoice.createMany({
    data: validInvoices,
  });

  return NextResponse.json({
    success: true,
    created: created.count,
    errors,
  });
}

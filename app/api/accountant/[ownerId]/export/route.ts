import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ownerId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ownerId } = await params;

  const access = await prisma.accountantAccess.findFirst({
    where: {
      ownerId,
      accountantEmail: session.user.email,
      status: "active",
    },
  });

  if (!access) {
    return NextResponse.json({ error: "No access to this account" }, { status: 403 });
  }

  const now = new Date();
  const taxYearStart = new Date(now.getFullYear(), 0, 1);
  const taxYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId: ownerId,
        createdAt: { gte: taxYearStart, lte: taxYearEnd },
      },
      orderBy: { createdAt: "desc" },
      select: {
        invoiceNumber: true,
        clientName: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        dueDate: true,
        paidAt: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        userId: ownerId,
        date: { gte: taxYearStart, lte: taxYearEnd },
      },
      orderBy: { date: "desc" },
      select: {
        date: true,
        description: true,
        amount: true,
        currency: true,
        vendor: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const invoiceRows = [
    "Type,Invoice#,Client,Amount,Currency,Status,Date,Due Date,Paid At",
    ...invoices.map(
      (inv) =>
        [
          "Invoice",
          inv.invoiceNumber ?? "",
          inv.clientName,
          inv.amount,
          inv.currency,
          inv.status,
          inv.createdAt.toISOString().split("T")[0],
          inv.dueDate.toISOString().split("T")[0],
          inv.paidAt ? inv.paidAt.toISOString().split("T")[0] : "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
    ),
    "",
    `Type,Date,Description,Vendor,Category,Amount,Currency`,
    ...expenses.map(
      (exp) =>
        [
          "Expense",
          exp.date.toISOString().split("T")[0],
          exp.description,
          exp.vendor ?? "",
          exp.category?.name ?? "",
          exp.amount,
          exp.currency,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
    ),
  ].join("\n");

  return new NextResponse(invoiceRows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="tax-year-${now.getFullYear()}.csv"`,
    },
  });
}

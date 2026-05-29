import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
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

  const type = req.nextUrl.searchParams.get("type") || "invoices";
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");

  const dateFilter: Record<string, Date> = {};
  if (start) dateFilter.gte = new Date(start);
  if (end) dateFilter.lte = new Date(end);

  if (type === "expenses") {
    const expenses = await prisma.expense.findMany({
      where: {
        userId: user.id,
        ...(Object.keys(dateFilter).length ? { date: dateFilter as any } : {}),
      },
      include: { category: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    const rows = expenses.map((e) => ({
      Date: e.date.toISOString().split("T")[0],
      Description: e.description,
      Amount: e.amount,
      Currency: e.currency,
      Vendor: e.vendor || "",
      Category: e.category?.name || "Uncategorised",
      "Tax Deductible": e.taxDeductible ? "Yes" : "No",
      Notes: e.notes || "",
    }));

    const csv = Papa.unparse(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expenses-${start || "all"}.csv"`,
      },
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      userId: user.id,
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = invoices.map((inv) => ({
    "Invoice #": inv.invoiceNumber || "",
    Client: inv.clientName,
    "Client Email": inv.clientEmail,
    Amount: inv.amount,
    Currency: inv.currency,
    Status: inv.status,
    "Due Date": inv.dueDate.toISOString().split("T")[0],
    "Paid At": inv.paidAt?.toISOString().split("T")[0] || "",
    "Created At": inv.createdAt.toISOString().split("T")[0],
    Notes: inv.notes || "",
  }));

  const csv = Papa.unparse(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="invoices-${start || "all"}.csv"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays } from "date-fns";
import { getTeamContext } from "@/lib/team-session";

const createInvoiceSchema = z.object({
  clientEmail: z.string().email(),
  hourlyRate: z.number().positive().optional(),
  dueDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
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

  const teamCtx = await getTeamContext(session);
  const effectiveUserId = teamCtx?.ownerId ?? user.id;

  const ownerUser = teamCtx
    ? await prisma.user.findUnique({
        where: { id: effectiveUserId },
        include: { businessProfile: true },
      })
    : user;
  if (!ownerUser) {
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { clientEmail, dueDate } = parsed.data;
  const hourlyRate = parsed.data.hourlyRate ?? ownerUser.businessProfile?.defaultHourlyRate;

  if (!hourlyRate) {
    return NextResponse.json(
      { error: "No hourly rate set. Set a default in settings or provide one." },
      { status: 400 },
    );
  }

  const entries = await prisma.timeEntry.findMany({
    where: { userId: effectiveUserId, clientEmail, invoiced: false, endTime: { not: null } },
  });

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No completed unbilled time entries for this client." },
      { status: 400 },
    );
  }

  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const totalHours = totalMinutes / 60;
  const amount = Math.round(totalHours * hourlyRate * 100) / 100;

  const clientName = entries.find((e) => e.clientName)?.clientName ?? clientEmail;

  const entryCurrencies = [...new Set(entries.map((e) => e.currency).filter(Boolean))];
  const invoiceCurrency = entryCurrencies.length === 1 ? entryCurrencies[0] : (ownerUser.businessProfile?.baseCurrency ?? "USD");

  const invoice = await prisma.invoice.create({
    data: {
      clientName,
      clientEmail,
      amount,
      currency: invoiceCurrency,
      dueDate: dueDate ? new Date(dueDate) : addDays(new Date(), 30),
      notes: `Created from ${entries.length} time entr${entries.length === 1 ? "y" : "ies"} (${Math.round(totalHours * 10) / 10} hours at $${hourlyRate}/hr)`,
      userId: effectiveUserId,
      lateFeeEnabled: ownerUser.lateFeeEnabled,
      lateFeeAmount: ownerUser.lateFeeType === "fixed" ? ownerUser.lateFeeValue : (ownerUser.lateFeeValue / 100) * amount,
      interestRate: ownerUser.interestEnabled ? ownerUser.interestRate : 0,
      feeCap: ownerUser.feeCap,
    },
  });

  await prisma.invoiceLineItem.createMany({
    data: entries.map((e, i) => ({
      invoiceId: invoice.id,
      description: e.description ?? `Time entry (${e.clientName ?? e.clientEmail})`,
      quantity: Math.round(((e.durationMinutes ?? 0) / 60) * 100) / 100,
      unitPrice: e.hourlyRate ?? hourlyRate,
      total: Math.round((((e.durationMinutes ?? 0) / 60) * (e.hourlyRate ?? hourlyRate)) * 100) / 100,
      sortOrder: i,
    })),
  });

  await prisma.timeEntry.updateMany({
    where: { id: { in: entries.map((e) => e.id) } },
    data: { invoiced: true, invoiceId: invoice.id },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}

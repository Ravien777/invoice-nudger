import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  let bp = user.businessProfile;
  if (!bp) {
    bp = await prisma.businessProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    taxRate: bp.taxRate,
    fiscalYearStart: bp.fiscalYearStart,
    taxSavingsAmount: bp.taxSavingsAmount,
    baseCurrency: bp.baseCurrency,
    defaultHourlyRate: bp.defaultHourlyRate,
  });
}

export async function PUT(request: Request) {
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

  const body = await request.json();

  const data: Record<string, unknown> = {};
  const bpData: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    }
    data.name = body.name.trim() || null;
  }

  if (body.taxRate !== undefined) {
    const rate = Number(body.taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "taxRate must be between 0 and 100" }, { status: 400 });
    }
    bpData.taxRate = rate / 100;
  }

  if (body.fiscalYearStart !== undefined) {
    const month = Number(body.fiscalYearStart);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "fiscalYearStart must be 1-12" }, { status: 400 });
    }
    bpData.fiscalYearStart = month;
  }

  if (body.taxSavingsAmount !== undefined) {
    const amount = Number(body.taxSavingsAmount);
    if (isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "taxSavingsAmount must be a non-negative number" }, { status: 400 });
    }
    bpData.taxSavingsAmount = amount;
  }

  if (body.baseCurrency !== undefined) {
    const currency = String(body.baseCurrency).toUpperCase();
    if (currency.length !== 3) {
      return NextResponse.json({ error: "baseCurrency must be a 3-letter ISO code" }, { status: 400 });
    }
    bpData.baseCurrency = currency;
  }

  if (body.defaultHourlyRate !== undefined) {
    const rate = Number(body.defaultHourlyRate);
    if (isNaN(rate) || rate < 0) {
      return NextResponse.json({ error: "defaultHourlyRate must be a non-negative number" }, { status: 400 });
    }
    bpData.defaultHourlyRate = rate;
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data,
    });
  }

  if (Object.keys(bpData).length > 0) {
    await prisma.businessProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...bpData },
      update: bpData,
    });
  }

  return NextResponse.json({ success: true });
}

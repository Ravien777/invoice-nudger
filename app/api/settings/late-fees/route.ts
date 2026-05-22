import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["fixed", "percentage"];
const VALID_FREQUENCIES = ["once", "recurring"];

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      lateFeeEnabled: true,
      lateFeeType: true,
      lateFeeValue: true,
      lateFeeFrequency: true,
      interestEnabled: true,
      interestRate: true,
      lateFeeGraceDays: true,
      feeCap: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: Request) {
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
  const {
    lateFeeEnabled,
    lateFeeType,
    lateFeeValue,
    lateFeeFrequency,
    interestEnabled,
    interestRate,
    lateFeeGraceDays,
    feeCap,
  } = body;

  if (typeof lateFeeEnabled !== "boolean") {
    return NextResponse.json({ error: "lateFeeEnabled must be a boolean" }, { status: 400 });
  }

  if (lateFeeType && !VALID_TYPES.includes(lateFeeType)) {
    return NextResponse.json({ error: "Invalid lateFeeType. Must be 'fixed' or 'percentage'" }, { status: 400 });
  }

  if (lateFeeFrequency && !VALID_FREQUENCIES.includes(lateFeeFrequency)) {
    return NextResponse.json({ error: "Invalid lateFeeFrequency. Must be 'once' or 'recurring'" }, { status: 400 });
  }

  if (lateFeeValue !== undefined && (typeof lateFeeValue !== "number" || lateFeeValue < 0)) {
    return NextResponse.json({ error: "lateFeeValue must be a non-negative number" }, { status: 400 });
  }

  if (interestRate !== undefined && (typeof interestRate !== "number" || interestRate < 0)) {
    return NextResponse.json({ error: "interestRate must be a non-negative number" }, { status: 400 });
  }

  if (lateFeeGraceDays !== undefined && (typeof lateFeeGraceDays !== "number" || lateFeeGraceDays < 0)) {
    return NextResponse.json({ error: "lateFeeGraceDays must be a non-negative number" }, { status: 400 });
  }

  if (feeCap !== undefined && (typeof feeCap !== "number" || feeCap < 0)) {
    return NextResponse.json({ error: "feeCap must be a non-negative number" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lateFeeEnabled,
      lateFeeType: lateFeeType ?? user.lateFeeType,
      lateFeeValue: lateFeeValue ?? user.lateFeeValue,
      lateFeeFrequency: lateFeeFrequency ?? user.lateFeeFrequency,
      interestEnabled: interestEnabled ?? user.interestEnabled,
      interestRate: interestRate ?? user.interestRate,
      lateFeeGraceDays: lateFeeGraceDays ?? user.lateFeeGraceDays,
      feeCap: feeCap ?? user.feeCap,
    },
  });

  return NextResponse.json({ success: true });
}

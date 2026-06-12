import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const lateFeeSchema = z.object({
  lateFeeEnabled: z.boolean(),
  lateFeeType: z.enum(["fixed", "percentage"]).optional(),
  lateFeeValue: z.number().min(0).optional(),
  lateFeeFrequency: z.enum(["once", "recurring"]).optional(),
  interestEnabled: z.boolean().optional(),
  interestRate: z.number().min(0).optional(),
  lateFeeGraceDays: z.number().min(0).int().optional(),
  feeCap: z.number().min(0).optional(),
});

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
  const parsed = lateFeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { lateFeeEnabled, lateFeeType, lateFeeValue, lateFeeFrequency, interestEnabled, interestRate, lateFeeGraceDays, feeCap } = parsed.data;

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

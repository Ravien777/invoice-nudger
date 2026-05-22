import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TONES = ["professional", "friendly", "firm", "casual"];

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
  const { enabled, tone } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  if (tone && !VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone value" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      aiRemindersEnabled: enabled,
      aiTone: tone ?? user.aiTone,
    },
  });

  return NextResponse.json({ success: true });
}

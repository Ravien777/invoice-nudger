import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { reminderLogId } = body;

  if (!reminderLogId) {
    return NextResponse.json({ error: "reminderLogId is required" }, { status: 400 });
  }

  const reminderLog = await prisma.reminderLog.findFirst({
    where: {
      id: reminderLogId,
      aiGenerated: true,
      invoice: { userId: user.id },
    },
    include: { invoice: true },
  });

  if (!reminderLog) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  if (reminderLog.approved) {
    return NextResponse.json({ error: "Reminder already approved" }, { status: 400 });
  }

  const updated = await prisma.reminderLog.update({
    where: { id: reminderLogId },
    data: { approved: true },
  });

  return NextResponse.json({ success: true, reminderLog: updated });
}

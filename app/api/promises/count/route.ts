import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ count: 0 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.promiseEvent.count({
    where: {
      invoice: { userId: user.id },
      status: "pending_review",
    },
  });

  return NextResponse.json({ count });
}

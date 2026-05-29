import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await prisma.expenseCategory.findUnique({
    where: { userId_name: { userId: user.id, name: name.trim() } },
  });
  if (existing) {
    return NextResponse.json({ category: existing });
  }

  const category = await prisma.expenseCategory.create({
    data: { userId: user.id, name: name.trim() },
  });

  return NextResponse.json({ category }, { status: 201 });
}

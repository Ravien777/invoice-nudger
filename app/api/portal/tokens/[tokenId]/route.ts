import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokePortalToken } from "@/lib/portal";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
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

  const { tokenId } = await params;

  const result = await revokePortalToken(user.id, tokenId);

  if (!result) {
    return NextResponse.json({ error: "Token not found or not owned by user" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

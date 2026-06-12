import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const { id } = await params;

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id },
  });

  if (!endpoint || endpoint.userId !== user.id) {
    return NextResponse.json({ error: "Webhook endpoint not found" }, { status: 404 });
  }

  await prisma.webhookDelivery.deleteMany({ where: { endpointId: id } });
  await prisma.webhookEndpoint.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

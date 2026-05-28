import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangePublicToken } from "@/lib/bank-client";
import { encrypt } from "@/lib/integrations/crypto";
import { z } from "zod";

const exchangeSchema = z.object({
  publicToken: z.string(),
  institutionName: z.string().optional(),
  accountName: z.string().optional(),
  accountMask: z.string().optional(),
});

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
  const parsed = exchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const { accessToken, itemId } = await exchangePublicToken(parsed.data.publicToken);

    const encrypted = encrypt(accessToken);

    const connection = await prisma.bankConnection.create({
      data: {
        userId: user.id,
        provider: "plaid",
        accessToken: encrypted,
        itemId,
        institutionName: parsed.data.institutionName ?? null,
        accountName: parsed.data.accountName ?? null,
        accountMask: parsed.data.accountMask ?? null,
      },
    });

    return NextResponse.json({
      id: connection.id,
      institutionName: connection.institutionName,
      accountMask: connection.accountMask,
    }, { status: 201 });
  } catch (e: any) {
    console.error("Failed to exchange token:", e);
    return NextResponse.json({ error: "Failed to connect bank account" }, { status: 500 });
  }
}

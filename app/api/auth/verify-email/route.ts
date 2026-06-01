import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/verify?error=missing", request.url));
  }

  const vt = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!vt || vt.expires < new Date()) {
    return NextResponse.redirect(new URL("/auth/verify?error=expired", request.url));
  }

  await prisma.user.update({
    where: { email: vt.identifier },
    data: { emailVerified: new Date() },
  });

  await prisma.verificationToken.delete({
    where: { token },
  });

  return NextResponse.redirect(new URL("/auth/verify?success=true", request.url));
}

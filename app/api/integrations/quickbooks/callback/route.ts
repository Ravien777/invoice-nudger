import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeQuickBooksCode } from "@/lib/integrations/quickbooks";
import { encrypt } from "@/lib/integrations/crypto";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const realmId = searchParams.get("realmId");

  if (error) {
    return redirect("/settings?integrations=error&message=" + encodeURIComponent(error));
  }

  if (!code) {
    return redirect("/settings?integrations=error&message=No+authorization+code");
  }

  try {
    const tokenResponse = await exchangeQuickBooksCode(code);

    if (!realmId) {
      return redirect("/settings?integrations=error&message=No+realm+ID+returned");
    }

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await prisma.integrationConnection.upsert({
      where: {
        userId_platform: { userId: user.id, platform: "quickbooks" },
      },
      create: {
        userId: user.id,
        platform: "quickbooks",
        tenantId: realmId,
        accessToken: encrypt(tokenResponse.access_token),
        refreshToken: encrypt(tokenResponse.refresh_token),
        expiresAt,
      },
      update: {
        tenantId: realmId,
        accessToken: encrypt(tokenResponse.access_token),
        refreshToken: encrypt(tokenResponse.refresh_token),
        expiresAt,
      },
    });

    return redirect("/settings?integrations=success&platform=quickbooks");
  } catch (err) {
    return redirect("/settings?integrations=error&message=" + encodeURIComponent((err as Error).message));
  }
}

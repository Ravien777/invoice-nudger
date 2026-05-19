import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeXeroCode, getXeroTenants } from "@/lib/integrations/xero";
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

  if (error) {
    return redirect("/settings?integrations=error&message=" + encodeURIComponent(error));
  }

  if (!code) {
    return redirect("/settings?integrations=error&message=No+authorization+code");
  }

  try {
    const tokenResponse = await exchangeXeroCode(code);
    const tenants = await getXeroTenants(tokenResponse.access_token);

    if (tenants.length === 0) {
      return redirect("/settings?integrations=error&message=No+Xero+organizations+found");
    }

    const tenant = tenants[0];
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await prisma.integrationConnection.upsert({
      where: {
        userId_platform: { userId: user.id, platform: "xero" },
      },
      create: {
        userId: user.id,
        platform: "xero",
        tenantId: tenant.id,
        accessToken: encrypt(tokenResponse.access_token),
        refreshToken: encrypt(tokenResponse.refresh_token),
        expiresAt,
      },
      update: {
        tenantId: tenant.id,
        accessToken: encrypt(tokenResponse.access_token),
        refreshToken: encrypt(tokenResponse.refresh_token),
        expiresAt,
      },
    });

    return redirect("/settings?integrations=success&platform=xero");
  } catch (err) {
    return redirect("/settings?integrations=error&message=" + encodeURIComponent((err as Error).message));
  }
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getXeroAuthUrl } from "@/lib/integrations/xero";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = getXeroAuthUrl(state);

  return Response.redirect(authUrl);
}

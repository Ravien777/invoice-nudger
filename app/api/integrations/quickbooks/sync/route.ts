import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncQuickBooks } from "@/lib/integrations/sync";

export async function POST() {
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

  const result = await syncQuickBooks(user.id);

  return Response.json(result);
}

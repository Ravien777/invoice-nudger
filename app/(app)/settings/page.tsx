import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const schedule = await prisma.reminderSchedule.findFirst({
    where: { userId: user!.id, isDefault: true },
    include: { steps: { orderBy: { daysOffset: "asc" } } },
  });

  const integrations = await prisma.integrationConnection.findMany({
    where: { userId: user!.id },
    orderBy: { platform: "asc" },
  });

  return <SettingsClient schedule={schedule} integrations={integrations} />;
}

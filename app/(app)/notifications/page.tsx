import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";
import { PageShell } from "@/app/components/layout/PageShell";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const [initialNotifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.notification.count({
      where: { userId: user!.id },
    }),
    prisma.notification.count({
      where: { userId: user!.id, read: false },
    }),
  ]);

  const serialized = initialNotifications.map((n) => ({
    ...n,
    metadata: n.metadata as Record<string, unknown> | null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <PageShell title="Notifications" subtitle="Manage your alerts and notifications">
      <NotificationsClient
        initialNotifications={serialized}
        initialTotal={total}
        initialUnreadCount={unreadCount}
      />
    </PageShell>
  );
}

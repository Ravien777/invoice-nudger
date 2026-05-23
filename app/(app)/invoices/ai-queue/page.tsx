import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AIQueueClient from "./AIQueueClient";
import { PageShell } from "@/app/components/layout/PageShell";

export default async function AIQueuePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/dev-signin");
  }

  return (
    <PageShell title="AI Reminder Queue" subtitle="Approve or reject AI-generated reminder emails">
      <AIQueueClient />
    </PageShell>
  );
}

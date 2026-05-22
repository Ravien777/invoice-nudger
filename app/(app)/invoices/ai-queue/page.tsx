import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AIQueueClient from "./AIQueueClient";

export default async function AIQueuePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/dev-signin");
  }

  return <AIQueueClient />;
}

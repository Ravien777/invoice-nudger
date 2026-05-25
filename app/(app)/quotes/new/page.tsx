import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/layout/PageShell";
import QuoteForm from "@/app/components/QuoteForm";

export default async function NewQuotePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  return (
    <PageShell title="New Quote" subtitle="Create a price estimate for your client.">
      <QuoteForm mode="create" />
    </PageShell>
  );
}

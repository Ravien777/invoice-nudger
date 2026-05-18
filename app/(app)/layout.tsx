import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import HeaderActions from "./components/HeaderActions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-foreground">
            Invoice Nudger
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-muted transition hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/invoices"
              className="text-sm text-muted transition hover:text-foreground"
            >
              Invoices
            </Link>
            <Link
              href="/settings"
              className="text-sm text-muted transition hover:text-foreground"
            >
              Settings
            </Link>
            <HeaderActions />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

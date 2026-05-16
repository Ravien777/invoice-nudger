import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-slate-900">
            Invoice Nudger
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/invoices"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Invoices
            </Link>
            <Link
              href="/settings"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Settings
            </Link>
            <span className="text-sm text-slate-400">
              {session.user?.email}
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/app/components/layout/Sidebar";
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
    <div className="flex min-h-screen bg-surface-primary">
      <Sidebar />
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: "var(--sidebar-current-width, 220px)" }}
      >
        <header className="h-14 flex items-center justify-end gap-2 px-6 border-b border-border-default bg-surface-primary shrink-0">
          <HeaderActions />
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { SidebarShell } from "@/components/SidebarShell";
import { getSidebarArticles } from "@/lib/personalizedNews";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id: string }).id : null;
  const articles = await getSidebarArticles(userId);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardNav />
      <div className="flex-1 py-6">
        <SidebarShell articles={articles}>{children}</SidebarShell>
      </div>
    </div>
  );
}

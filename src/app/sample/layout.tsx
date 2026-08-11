import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SampleNav } from "@/components/sample/SampleNav";
import { SidebarShell } from "@/components/SidebarShell";
import { getSidebarArticles } from "@/lib/personalizedNews";

export default async function SampleLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session ? (session.user as { id: string }).id : null;
  const articles = await getSidebarArticles(userId);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SampleNav />
      <div className="flex-1 py-6">
        <SidebarShell articles={articles}>{children}</SidebarShell>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SidebarShell } from "@/components/SidebarShell";
import { getSidebarArticles } from "@/lib/personalizedNews";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session ? (session.user as { id: string }).id : null;
  const articles = await getSidebarArticles(userId);

  return (
    <div className="py-6">
      <SidebarShell articles={articles}>{children}</SidebarShell>
    </div>
  );
}

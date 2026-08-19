import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { SidebarShell } from "@/components/SidebarShell";
import { TermsGate } from "@/components/TermsGate";
import { getSidebarArticles } from "@/lib/personalizedNews";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id: string }).id : null;

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { termsAcceptedVersion: true } });
    if (!user || user.termsAcceptedVersion == null || user.termsAcceptedVersion < CURRENT_TERMS_VERSION) {
      return (
        <div className="flex min-h-full flex-1 flex-col">
          <TermsGate isUpdate={!!user?.termsAcceptedVersion} />
        </div>
      );
    }
  }

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

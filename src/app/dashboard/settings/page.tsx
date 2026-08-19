import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/gemini";
import { isPlaidConfigured } from "@/lib/plaid";
import { isTotpConfigured } from "@/lib/totp";
import { ConfigStatus } from "@/components/dashboard/ConfigStatus";
import { GoalEditor } from "@/components/dashboard/GoalEditor";
import { ExitRulesManager } from "@/components/dashboard/ExitRulesManager";
import { WatchlistManager } from "@/components/dashboard/WatchlistManager";
import { PlaidItemsList } from "@/components/dashboard/PlaidItemsList";
import { TwoFactorSection } from "@/components/dashboard/TwoFactorSection";
import { DeleteAccountSection } from "@/components/dashboard/DeleteAccountSection";
import { Card } from "@/components/ui/Card";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const [goal, exitRules, watchlistItems, plaidItems, user] = await Promise.all([
    prisma.goal.findUnique({ where: { userId } }),
    prisma.exitRule.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.watchlistItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.plaidItem.findMany({
      where: { userId },
      select: { id: true, institutionName: true, status: true, lastSyncedAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">Settings</p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
        Manage Your Account
      </h1>

      <div className="mt-6 flex flex-col gap-5">
        <ConfigStatus aiConfigured={isAiConfigured()} plaidConfigured={isPlaidConfigured()} />
        <PlaidItemsList items={plaidItems} plaidConfigured={isPlaidConfigured()} />
        <TwoFactorSection initialEnabled={user?.twoFactorEnabled ?? false} totpConfigured={isTotpConfigured()} />
        <GoalEditor initialGoal={goal} />
        <WatchlistManager initialItems={watchlistItems} />
        <ExitRulesManager initialRules={exitRules} />
        <Card>
          <h2 className="font-[family-name:var(--font-heading)] font-bold text-ink-900">Legal</h2>
          <p className="mt-2 text-sm text-ink-700">
            <Link href="/terms" className="font-semibold text-teal-600 hover:underline">
              Terms of Service
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="font-semibold text-teal-600 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </Card>
      </div>

      <DeleteAccountSection />
    </div>
  );
}

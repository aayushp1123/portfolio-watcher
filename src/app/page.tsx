import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HeroChart } from "@/components/graphics/HeroChart";
import { IconDigest, IconTrends, IconNews } from "@/components/graphics/FeatureIcons";
import { NewsSidebar } from "@/components/NewsSidebar";
import { getPersonalizedNews } from "@/lib/newsFeed";

async function getUserTickers(userId: string): Promise<string[]> {
  const [watchlistItems, plaidItems] = await Promise.all([
    prisma.watchlistItem.findMany({ where: { userId }, select: { ticker: true } }),
    prisma.plaidItem.findMany({
      where: { userId, status: "active" },
      select: { lastHoldingsJson: true },
    }),
  ]);

  const tickers = watchlistItems.map((w) => w.ticker);
  for (const item of plaidItems) {
    if (!item.lastHoldingsJson) continue;
    try {
      const parsed = JSON.parse(item.lastHoldingsJson) as {
        securities?: Array<{ ticker_symbol: string | null }>;
      };
      for (const s of parsed.securities ?? []) {
        if (s.ticker_symbol) tickers.push(s.ticker_symbol);
      }
    } catch {
      // Skip malformed cached holdings.
    }
  }
  return tickers;
}

export default async function Home() {
  const session = await getServerSession(authOptions);
  const loggedIn = !!session;
  const userId = loggedIn ? (session!.user as { id: string }).id : null;

  const tickers = userId ? await getUserTickers(userId) : [];
  const articles = await getPersonalizedNews(tickers);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <nav className="sticky top-0 z-10 border-b border-line bg-paper-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
            Portfolio Watcher
          </span>
          {loggedIn ? (
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/sample" className="text-sm font-semibold text-ink-700 hover:text-teal-600">
                See a sample dashboard
              </Link>
              <Link href="/login" className="text-sm text-ink-500 hover:text-teal-600">
                Log in
              </Link>
              <Link href="/signup">
                <Button>Sign up free</Button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_320px] lg:px-8">
      <div className="min-w-0">
      <section className="flex flex-col items-center py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
          Personal Portfolio Tracker
        </p>
        <h1 className="mt-1 max-w-xl font-[family-name:var(--font-heading)] text-4xl font-bold text-ink-900">
          Portfolio Watcher
        </h1>
        <p className="mt-4 max-w-md text-ink-500">
          Connect a brokerage account, set your goals and exit rules, and get daily digests, weekly
          research, and breaking-news alerts written specifically for the positions you actually hold.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {loggedIn ? (
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/signup">
                <Button>Create a free account</Button>
              </Link>
              <Link href="/sample">
                <Button variant="secondary">See a sample dashboard</Button>
              </Link>
            </>
          )}
        </div>
        <div className="mt-12 w-full max-w-xl px-4">
          <HeroChart />
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-10">
        <h2 className="text-center font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
          What you get
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <IconDigest className="h-8 w-8" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-teal-600">Every day</p>
            <h3 className="mt-1 font-[family-name:var(--font-heading)] font-bold text-ink-900">
              Daily Digest
            </h3>
            <p className="mt-2 text-sm text-ink-500">
              Total value, a Buy/Hold/Sell rating and risk read on every holding, exit-rule status,
              dividend notes, and tax considerations.
            </p>
          </Card>
          <Card>
            <IconTrends className="h-8 w-8" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-teal-600">Every week</p>
            <h3 className="mt-1 font-[family-name:var(--font-heading)] font-bold text-ink-900">
              Weekly Trends
            </h3>
            <p className="mt-2 text-sm text-ink-500">
              How your actual allocation compares to the goal you set, what's moving in the market, and
              a couple of new stock or ETF ideas worth knowing about.
            </p>
          </Card>
          <Card>
            <IconNews className="h-8 w-8" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-teal-600">As it happens</p>
            <h3 className="mt-1 font-[family-name:var(--font-heading)] font-bold text-ink-900">
              Breaking News
            </h3>
            <p className="mt-2 text-sm text-ink-500">
              A quiet, no-hype watch for material news or big price moves on things you actually own —
              nothing flagged twice, nothing sensational.
            </p>
          </Card>
        </div>
        {!loggedIn && (
          <p className="mt-6 text-center text-sm text-ink-500">
            Not sure what any of that looks like yet?{" "}
            <Link href="/sample" className="font-semibold text-teal-600 hover:underline">
              Walk through a sample dashboard
            </Link>{" "}
            with realistic example data — no account needed.
          </p>
        )}
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-10">
        <h2 className="text-center font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
          How it works
        </h2>
        <div className="mt-6 flex flex-col gap-4">
          <Card className="flex items-start gap-4">
            <span className="font-[family-name:var(--font-heading)] text-xl font-bold text-teal-600">
              1
            </span>
            <div>
              <h3 className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
                Create your account and set your goals
              </h3>
              <p className="mt-1 text-sm text-ink-500">
                Sign up, then tell it your target allocation and any exit rules — like &ldquo;sell if this
                hits $40&rdquo; — in your own words.
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-4">
            <span className="font-[family-name:var(--font-heading)] text-xl font-bold text-teal-600">
              2
            </span>
            <div>
              <h3 className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
                Connect a brokerage account
              </h3>
              <p className="mt-1 text-sm text-ink-500">
                Securely link your holdings through Plaid. Your access token is encrypted at rest, and
                nothing is ever sold or shared.
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-4">
            <span className="font-[family-name:var(--font-heading)] text-xl font-bold text-teal-600">
              3
            </span>
            <div>
              <h3 className="font-[family-name:var(--font-heading)] font-bold text-ink-900">
                Get reports built specifically around what you own
              </h3>
              <p className="mt-1 text-sm text-ink-500">
                Every report is researched fresh against your actual holdings, cost basis, and goals.
              </p>
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-16">
        <Card className="bg-teal-100 border-none text-center">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Free to explore, always
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-900">
            Creating an account, setting goals, and browsing the sample dashboard cost nothing and never
            will. Connecting a real brokerage account and generating live AI reports are optional,
            separate steps you turn on yourself when you're ready — never automatic, never a surprise
            charge.
          </p>
        </Card>
      </section>
      </div>

      <NewsSidebar articles={articles} />
      </div>
    </div>
  );
}

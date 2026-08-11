import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const reports = await prisma.report.findMany({
  orderBy: { generatedAt: "desc" },
  take: 6,
});

for (const r of reports) {
  const content = JSON.parse(r.content);
  console.log(`\n=== ${r.type} | user ${r.userId} | ${r.generatedAt.toISOString()} ===`);
  if (r.type === "DAILY_DIGEST") {
    console.log("holdings:", content.holdings?.length, "watchlist:", content.watchlistItems?.length);
    console.log("bottomLine:", content.bottomLine?.slice(0, 200));
  } else if (r.type === "WEEKLY_TRENDS") {
    console.log("newIdeas:", content.newIdeas?.length, "watchlist:", content.watchlistItems?.length);
    console.log("allocationCheck.summary:", content.allocationCheck?.summary?.slice(0, 200));
  } else if (r.type === "BREAKING_NEWS") {
    console.log("hasMaterialEvents:", content.hasMaterialEvents, "alerts:", content.alerts?.length);
  }
}

await prisma.$disconnect();

-- CreateTable
CREATE TABLE "SecFactsCache" (
    "ticker" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecFactsCache_pkey" PRIMARY KEY ("ticker")
);

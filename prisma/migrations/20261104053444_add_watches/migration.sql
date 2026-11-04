-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'PAUSED');

-- CreateEnum
CREATE TYPE "AlertMode" AS ENUM ('PAGE_CHANGES', 'NEW_LINE_KEYWORDS', 'KEYWORDS_APPEAR', 'KEYWORDS_DISAPPEAR');

-- CreateEnum
CREATE TYPE "MatchMode" AS ENUM ('ANY', 'ALL');

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "selector" TEXT,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "WatchStatus" NOT NULL DEFAULT 'PENDING',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertMode" "AlertMode" NOT NULL DEFAULT 'PAGE_CHANGES',
    "keywords" TEXT[],
    "matchMode" "MatchMode" NOT NULL DEFAULT 'ANY',
    "keywordState" BOOLEAN,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangedAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Watch_userId_idx" ON "Watch"("userId");

-- CreateIndex
CREATE INDEX "Watch_status_nextCheckAt_idx" ON "Watch"("status", "nextCheckAt");

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

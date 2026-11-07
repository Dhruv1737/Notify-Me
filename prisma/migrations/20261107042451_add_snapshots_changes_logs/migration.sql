-- AlterTable
ALTER TABLE "Watch" ADD COLUMN     "warning" TEXT;

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Change" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "fromSnapshotId" TEXT,
    "toSnapshotId" TEXT,
    "added" TEXT[],
    "removed" TEXT[],
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "matchedKeywords" TEXT[],
    "matchedLines" TEXT[],
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckLog" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,

    CONSTRAINT "CheckLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_watchId_createdAt_idx" ON "Snapshot"("watchId", "createdAt");

-- CreateIndex
CREATE INDEX "Change_watchId_createdAt_idx" ON "Change"("watchId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckLog_watchId_checkedAt_idx" ON "CheckLog"("watchId", "checkedAt");

-- CreateIndex
CREATE INDEX "CheckLog_checkedAt_idx" ON "CheckLog"("checkedAt");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_fromSnapshotId_fkey" FOREIGN KEY ("fromSnapshotId") REFERENCES "Snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_toSnapshotId_fkey" FOREIGN KEY ("toSnapshotId") REFERENCES "Snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckLog" ADD CONSTRAINT "CheckLog_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "GridResult" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "episodeId" TEXT,
    "historyId" INTEGER,
    "mediaFileId" INTEGER,
    "layout" TEXT NOT NULL DEFAULT '3x3',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "sourceShotRefs" JSONB NOT NULL DEFAULT '[]',
    "rawModelOutput" TEXT NOT NULL DEFAULT '',
    "validationPassed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GridResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridPanel" (
    "id" SERIAL NOT NULL,
    "gridResultId" INTEGER NOT NULL,
    "panelOrder" INTEGER NOT NULL,
    "timeRange" TEXT NOT NULL DEFAULT '',
    "seedancePrompt" TEXT NOT NULL DEFAULT '',
    "imagePromptText" TEXT NOT NULL DEFAULT '',
    "sourceShotRefs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GridPanel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GridPanel_gridResultId_panelOrder_key" ON "GridPanel"("gridResultId", "panelOrder");

-- AddForeignKey
ALTER TABLE "GridResult" ADD CONSTRAINT "GridResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridResult" ADD CONSTRAINT "GridResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridResult" ADD CONSTRAINT "GridResult_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridResult" ADD CONSTRAINT "GridResult_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "HistoryRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridResult" ADD CONSTRAINT "GridResult_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridPanel" ADD CONSTRAINT "GridPanel_gridResultId_fkey" FOREIGN KEY ("gridResultId") REFERENCES "GridResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

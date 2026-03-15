-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "sourceText" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN     "assetSlot" TEXT,
ADD COLUMN     "assetType" TEXT,
ADD COLUMN     "episodeId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "adaptMode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "currentStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "episodeCountMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "importError" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "importStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN     "lastCompletedStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceMode" TEXT NOT NULL DEFAULT 'ai',
ADD COLUMN     "sourceScript" TEXT NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

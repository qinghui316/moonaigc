-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "textSettings" JSONB NOT NULL DEFAULT '{}',
    "visionSettings" JSONB NOT NULL DEFAULT '{}',
    "platformKeys" JSONB NOT NULL DEFAULT '{}',
    "visionPlatformKeys" JSONB NOT NULL DEFAULT '{}',
    "platformModels" JSONB NOT NULL DEFAULT '{}',
    "visionPlatformModels" JSONB NOT NULL DEFAULT '{}',
    "platformEndpoints" JSONB NOT NULL DEFAULT '{}',
    "visionPlatformEndpoints" JSONB NOT NULL DEFAULT '{}',
    "autoSafety" BOOLEAN NOT NULL DEFAULT false,
    "autoSound" BOOLEAN NOT NULL DEFAULT true,
    "enableWordFilter" BOOLEAN NOT NULL DEFAULT true,
    "autoSaveHistory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genre" JSONB NOT NULL DEFAULT '[]',
    "audience" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT '',
    "endingType" TEXT NOT NULL DEFAULT '',
    "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
    "worldSetting" TEXT NOT NULL DEFAULT '',
    "creativePlan" TEXT NOT NULL DEFAULT '',
    "characterDoc" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "hookType" TEXT NOT NULL DEFAULT '',
    "mark" TEXT NOT NULL DEFAULT '',
    "script" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'outline',

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryRecord" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "episodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "plot" TEXT NOT NULL DEFAULT '',
    "fullPlot" TEXT NOT NULL DEFAULT '',
    "director" TEXT NOT NULL DEFAULT '',
    "directorId" TEXT NOT NULL DEFAULT '',
    "storyboard" TEXT NOT NULL DEFAULT '',
    "time" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "HistoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialSet" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "MaterialSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" SERIAL NOT NULL,
    "historyId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "timeRange" TEXT NOT NULL DEFAULT '',
    "shotType" TEXT NOT NULL DEFAULT '',
    "camera" TEXT NOT NULL DEFAULT '',
    "scene" TEXT NOT NULL DEFAULT '',
    "lighting" TEXT NOT NULL DEFAULT '',
    "drama" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL DEFAULT '',
    "genParams" JSONB,
    "imageFileId" INTEGER,
    "videoFileId" INTEGER,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialSet_userId_projectId_key" ON "MaterialSet"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryRecord" ADD CONSTRAINT "HistoryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryRecord" ADD CONSTRAINT "HistoryRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryRecord" ADD CONSTRAINT "HistoryRecord_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSet" ADD CONSTRAINT "MaterialSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSet" ADD CONSTRAINT "MaterialSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "HistoryRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_videoFileId_fkey" FOREIGN KEY ("videoFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

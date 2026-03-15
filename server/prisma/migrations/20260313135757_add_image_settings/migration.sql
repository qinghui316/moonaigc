-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "imagePlatformEndpoints" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "imagePlatformKeys" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "imagePlatformModels" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "imageSettings" JSONB NOT NULL DEFAULT '{}';

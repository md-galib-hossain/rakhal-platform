-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('CATTLE', 'HEALTH', 'REPRODUCTION', 'CALF', 'FARM', 'USER');

-- CreateEnum
CREATE TYPE "MediaUsage" AS ENUM ('PROFILE_PHOTO', 'GALLERY', 'PRESCRIPTION_IMAGE', 'DISEASE_IMAGE', 'FARM_LOGO', 'AVATAR');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');

-- AlterTable
ALTER TABLE "Cattle" ADD COLUMN     "profilePhotoAssetId" TEXT;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "category" "MediaCategory" NOT NULL,
    "usage" "MediaUsage" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "variants" JSONB,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "detectedFormat" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "originalFileName" TEXT,
    "originalByteSize" INTEGER NOT NULL,
    "processedByteSize" INTEGER,
    "sha256" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_farmId_idx" ON "MediaAsset"("farmId");

-- CreateIndex
CREATE INDEX "MediaAsset_farmId_category_usage_idx" ON "MediaAsset"("farmId", "category", "usage");

-- CreateIndex
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");

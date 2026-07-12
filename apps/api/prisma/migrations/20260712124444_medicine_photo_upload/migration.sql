-- AlterEnum
ALTER TYPE "MediaCategory" ADD VALUE 'MEDICINE';

-- AlterEnum
ALTER TYPE "MediaUsage" ADD VALUE 'PRODUCT_PHOTO';

-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN     "photoAssetId" TEXT;

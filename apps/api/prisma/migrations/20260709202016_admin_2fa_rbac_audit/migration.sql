-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformAdminRole" ADD VALUE 'SUPPORT_ADMIN';
ALTER TYPE "PlatformAdminRole" ADD VALUE 'BILLING_ADMIN';
ALTER TYPE "PlatformAdminRole" ADD VALUE 'CONTENT_ADMIN';

-- AlterTable
ALTER TABLE "PlatformAdmin" ADD COLUMN     "lastLoginIp" TEXT,
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;

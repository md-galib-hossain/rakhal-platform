-- CreateEnum
CREATE TYPE "Language" AS ENUM ('BN', 'EN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredLanguage" "Language" NOT NULL DEFAULT 'BN';

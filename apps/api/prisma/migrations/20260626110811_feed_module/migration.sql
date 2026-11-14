-- CreateEnum
CREATE TYPE "FeedIngredientCategory" AS ENUM ('ROUGHAGE', 'CONCENTRATE', 'SILAGE', 'SUPPLEMENT', 'BY_PRODUCT');

-- CreateEnum
CREATE TYPE "FeedTargetType" AS ENUM ('GROUP', 'INDIVIDUAL');

-- CreateTable
CREATE TABLE "FeedIngredient" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "category" "FeedIngredientCategory" NOT NULL,
    "dmPct" DOUBLE PRECISION NOT NULL,
    "cpPct" DOUBLE PRECISION NOT NULL,
    "rdpPct" DOUBLE PRECISION,
    "rupPct" DOUBLE PRECISION,
    "meMjPerKgDm" DOUBLE PRECISION NOT NULL,
    "fatPct" DOUBLE PRECISION,
    "starchPct" DOUBLE PRECISION,
    "ndfPct" DOUBLE PRECISION,
    "sugarsPct" DOUBLE PRECISION,
    "nutritionSource" TEXT,
    "currentPricePerKg" DOUBLE PRECISION NOT NULL,
    "priceUpdatedAt" TIMESTAMP(3),
    "isAvailableBd" BOOLEAN NOT NULL DEFAULT true,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedIngredientOverride" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "customPricePerKg" DOUBLE PRECISION,
    "customDmPct" DOUBLE PRECISION,
    "customCpPct" DOUBLE PRECISION,
    "customMeMjPerKgDm" DOUBLE PRECISION,
    "customFatPct" DOUBLE PRECISION,
    "customNdfPct" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedIngredientOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedConcentration" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER,
    "targetType" "FeedTargetType" NOT NULL DEFAULT 'GROUP',
    "feedGroupId" TEXT,
    "cattleId" TEXT,
    "targetWeightKg" DOUBLE PRECISION,
    "targetMilkL" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedConcentration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedConcentrationItem" (
    "id" TEXT NOT NULL,
    "concentrationId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amountKg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FeedConcentrationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedIngredient_category_idx" ON "FeedIngredient"("category");

-- CreateIndex
CREATE INDEX "FeedIngredient_isActive_idx" ON "FeedIngredient"("isActive");

-- CreateIndex
CREATE INDEX "FeedIngredientOverride_farmId_idx" ON "FeedIngredientOverride"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedIngredientOverride_farmId_ingredientId_key" ON "FeedIngredientOverride"("farmId", "ingredientId");

-- CreateIndex
CREATE INDEX "FeedConcentration_farmId_idx" ON "FeedConcentration"("farmId");

-- CreateIndex
CREATE INDEX "FeedConcentration_farmId_feedGroupId_idx" ON "FeedConcentration"("farmId", "feedGroupId");

-- CreateIndex
CREATE INDEX "FeedConcentrationItem_concentrationId_idx" ON "FeedConcentrationItem"("concentrationId");

-- CreateIndex
CREATE INDEX "FeedConcentrationItem_ingredientId_idx" ON "FeedConcentrationItem"("ingredientId");

-- AddForeignKey
ALTER TABLE "FeedIngredientOverride" ADD CONSTRAINT "FeedIngredientOverride_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedIngredientOverride" ADD CONSTRAINT "FeedIngredientOverride_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "FeedIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedConcentration" ADD CONSTRAINT "FeedConcentration_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedConcentrationItem" ADD CONSTRAINT "FeedConcentrationItem_concentrationId_fkey" FOREIGN KEY ("concentrationId") REFERENCES "FeedConcentration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedConcentrationItem" ADD CONSTRAINT "FeedConcentrationItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "FeedIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

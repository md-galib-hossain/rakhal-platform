-- CreateEnum
CREATE TYPE "CattleGender" AS ENUM ('MALE', 'FEMALE', 'CASTRATED_MALE');

-- CreateEnum
CREATE TYPE "CattlePurpose" AS ENUM ('MILK', 'BREEDING', 'MEAT', 'CALF', 'BULL_SERVICE', 'DUAL_PURPOSE');

-- CreateEnum
CREATE TYPE "CattleStatus" AS ENUM ('ACTIVE', 'SOLD', 'DEAD', 'TRANSFERRED', 'MISSING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CattleSourceType" AS ENUM ('BORN', 'PURCHASED', 'GIFTED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Breed" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shed" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cattle" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT,
    "tagNumber" TEXT NOT NULL,
    "image" TEXT,
    "breedId" TEXT,
    "gender" "CattleGender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "purpose" "CattlePurpose" NOT NULL,
    "status" "CattleStatus" NOT NULL DEFAULT 'ACTIVE',
    "shedId" TEXT,
    "motherId" TEXT,
    "fatherId" TEXT,
    "sourceType" "CattleSourceType" NOT NULL DEFAULT 'UNKNOWN',
    "color" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cattle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Breed_farmId_idx" ON "Breed"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_farmId_name_key" ON "Breed"("farmId", "name");

-- CreateIndex
CREATE INDEX "Shed_farmId_idx" ON "Shed"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Shed_farmId_code_key" ON "Shed"("farmId", "code");

-- CreateIndex
CREATE INDEX "Cattle_farmId_idx" ON "Cattle"("farmId");

-- CreateIndex
CREATE INDEX "Cattle_breedId_idx" ON "Cattle"("breedId");

-- CreateIndex
CREATE INDEX "Cattle_shedId_idx" ON "Cattle"("shedId");

-- CreateIndex
CREATE INDEX "Cattle_status_idx" ON "Cattle"("status");

-- CreateIndex
CREATE INDEX "Cattle_motherId_idx" ON "Cattle"("motherId");

-- CreateIndex
CREATE INDEX "Cattle_fatherId_idx" ON "Cattle"("fatherId");

-- CreateIndex
CREATE INDEX "Cattle_createdBy_idx" ON "Cattle"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "Cattle_farmId_tagNumber_key" ON "Cattle"("farmId", "tagNumber");

-- AddForeignKey
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shed" ADD CONSTRAINT "Shed_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_shedId_fkey" FOREIGN KEY ("shedId") REFERENCES "Shed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Cattle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "Cattle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

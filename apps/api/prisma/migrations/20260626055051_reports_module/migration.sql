-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "ReportJobStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "params" JSONB NOT NULL,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'GENERATING',
    "title" TEXT,
    "fileName" TEXT,
    "fileData" BYTEA,
    "byteSize" INTEGER,
    "error" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportJob_farmId_idx" ON "ReportJob"("farmId");

-- CreateIndex
CREATE INDEX "ReportJob_farmId_status_idx" ON "ReportJob"("farmId", "status");

-- CreateIndex
CREATE INDEX "ReportJob_farmId_reportId_idx" ON "ReportJob"("farmId", "reportId");

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

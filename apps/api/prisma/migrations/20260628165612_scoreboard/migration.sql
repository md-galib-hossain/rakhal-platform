-- CreateTable
CREATE TABLE "ScoreboardParticipation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedTermsAt" TIMESTAMP(3) NOT NULL,
    "joinedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreboardParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreboardParticipation_farmId_key" ON "ScoreboardParticipation"("farmId");

-- AddForeignKey
ALTER TABLE "ScoreboardParticipation" ADD CONSTRAINT "ScoreboardParticipation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

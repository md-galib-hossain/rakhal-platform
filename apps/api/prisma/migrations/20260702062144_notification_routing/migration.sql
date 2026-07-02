-- CreateEnum
CREATE TYPE "RoutingScope" AS ENUM ('GLOBAL', 'FARM');

-- CreateTable
CREATE TABLE "NotificationRoutingRule" (
    "id" TEXT NOT NULL,
    "scope" "RoutingScope" NOT NULL,
    "farmId" TEXT,
    "eventKey" TEXT,
    "category" TEXT,
    "channels" TEXT[],
    "fallbackOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationRoutingRule_scope_farmId_idx" ON "NotificationRoutingRule"("scope", "farmId");

-- CreateIndex
CREATE INDEX "NotificationRoutingRule_eventKey_idx" ON "NotificationRoutingRule"("eventKey");

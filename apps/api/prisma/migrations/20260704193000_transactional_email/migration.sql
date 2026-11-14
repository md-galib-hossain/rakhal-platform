-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'PAYMENT_FAILED';

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_idempotencyKey_key" ON "EmailLog"("idempotencyKey");

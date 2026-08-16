-- RAKHAL-330: breeding-event cost -> Finance link + payment source.
-- Purely additive, nullable columns.

ALTER TABLE "SemenBatch" ADD COLUMN "costPerUnit" DOUBLE PRECISION;

ALTER TABLE "BreedingEvent" ADD COLUMN "paymentMethod" "FinancePaymentMethod";
ALTER TABLE "BreedingEvent" ADD COLUMN "financeTransactionId" TEXT;

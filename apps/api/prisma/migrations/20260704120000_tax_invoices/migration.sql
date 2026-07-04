-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "sellerName" TEXT,
ADD COLUMN     "sellerAddress" TEXT,
ADD COLUMN     "sellerBin" TEXT,
ADD COLUMN     "placeOfSupply" TEXT;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

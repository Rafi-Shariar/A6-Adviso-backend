/*
  Warnings:

  - You are about to drop the column `GatewayResponse` on the `payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[merchantInvoiceNumber]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bkashPaymentId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `merchantInvoiceNumber` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payments" DROP COLUMN "GatewayResponse",
ADD COLUMN     "bkashPaymentId" TEXT,
ADD COLUMN     "bkashTrxId" TEXT,
ADD COLUMN     "gatewayResponse" JSONB,
ADD COLUMN     "merchantInvoiceNumber" TEXT NOT NULL,
ADD COLUMN     "payerReference" TEXT,
ADD COLUMN     "refundAmount" DECIMAL(10,2),
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundTrxId" TEXT,
ADD COLUMN     "refundedAt" TEXT,
ALTER COLUMN "method" SET DEFAULT 'BKASH',
ALTER COLUMN "platformCharge" DROP NOT NULL,
ALTER COLUMN "mentorEarnings" DROP NOT NULL,
ALTER COLUMN "paidAt" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchantInvoiceNumber_key" ON "payments"("merchantInvoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_bkashPaymentId_key" ON "payments"("bkashPaymentId");

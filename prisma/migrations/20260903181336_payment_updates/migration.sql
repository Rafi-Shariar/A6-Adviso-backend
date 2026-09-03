/*
  Warnings:

  - You are about to drop the column `merchantInvoiceNumber` on the `payments` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "payments_merchantInvoiceNumber_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "merchantInvoiceNumber";

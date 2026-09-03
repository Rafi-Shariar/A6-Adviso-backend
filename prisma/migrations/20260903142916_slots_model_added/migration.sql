/*
  Warnings:

  - A unique constraint covering the columns `[slotId]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slotId` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "slotId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "slots" (
    "slotId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startTime" TIME(6) NOT NULL,
    "endTime" TIME(6) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("slotId")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_slotId_key" ON "sessions"("slotId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots"("slotId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("scheduleId") ON DELETE CASCADE ON UPDATE CASCADE;

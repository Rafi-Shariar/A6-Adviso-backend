/*
  Warnings:

  - Added the required column `mentorId` to the `reviews` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "mentorId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentors"("mentorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "mentors" ADD COLUMN     "resumePublicId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

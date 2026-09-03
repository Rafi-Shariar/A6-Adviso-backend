-- CreateEnum
CREATE TYPE "MentorshipStatus" AS ENUM ('OPEN', 'BLOCKED');

-- AlterTable
ALTER TABLE "mentors" ADD COLUMN     "mentorshipStatus" "MentorshipStatus" NOT NULL DEFAULT 'OPEN';

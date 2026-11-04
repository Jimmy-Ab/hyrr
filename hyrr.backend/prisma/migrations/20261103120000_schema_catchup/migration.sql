-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'INTERVIEWING';
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "applicationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedByRecruiter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedBySeeker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiverId" TEXT;

-- AlterTable
ALTER TABLE "SystemSetting" ALTER COLUMN "activeModel" SET DEFAULT 'gemini-2.5-flash';

-- AlterTable
ALTER TABLE "UserSetting" ADD COLUMN     "applicationUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "interviewReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "jobRecommendations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "messageNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "offerNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "profilePublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "resumeVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showActivity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyDigest" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable: aiScore is null until the AI has actually scored the application
ALTER TABLE "Application" ALTER COLUMN "aiScore" DROP NOT NULL,
ALTER COLUMN "aiScore" DROP DEFAULT;
UPDATE "Application" SET "aiScore" = NULL WHERE "aiScore" = 0 AND "aiSummary" IS NULL;

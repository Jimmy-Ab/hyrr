-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('DIRECT', 'GUEST', 'RECRUITER_ADDED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "source" "ApplicationSource" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "ApplicationNote" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "JobAlert" ADD COLUMN     "lastSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_createdAt_idx" ON "ApplicationNote"("applicationId", "createdAt");


-- Backfill application source for rows created before it was tracked.
-- No account: recruiter-added candidates have an initial stage event with a recruiter as actor;
-- guest applications have an initial stage event without an actor.
UPDATE "Application" a SET "source" = 'RECRUITER_ADDED'
WHERE a."userId" IS NULL AND EXISTS (
  SELECT 1 FROM "ApplicationStageEvent" e
  WHERE e."applicationId" = a."id" AND e."fromStatus" IS NULL AND e."actorId" IS NOT NULL
);
UPDATE "Application" SET "source" = 'GUEST'
WHERE "userId" IS NULL AND "source" = 'DIRECT';

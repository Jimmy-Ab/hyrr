-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "aiAnalysis" JSONB,
ADD COLUMN     "aiError" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiScoredAt" TIMESTAMP(3),
ADD COLUMN     "aiStatus" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "targetId" TEXT;

-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationState_userId_idx" ON "ConversationState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_applicationId_userId_key" ON "ConversationState"("applicationId", "userId");

-- CreateIndex
CREATE INDEX "Message_applicationId_createdAt_idx" ON "Message"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_senderId_clientId_key" ON "Message"("senderId", "clientId");

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Backfill ─────────────────────────────────────────────────────────────────
-- Existing scores are finished analyses.
UPDATE "Application" SET "aiStatus" = 'DONE', "aiScoredAt" = "updatedAt" WHERE "aiScore" IS NOT NULL;

-- Seeker side: read position + "deleted" position from the legacy per-side flags.
INSERT INTO "ConversationState" ("id", "applicationId", "userId", "lastReadAt", "clearedAt", "updatedAt")
SELECT gen_random_uuid()::text, a."id", a."userId",
       MAX(m."createdAt") FILTER (WHERE m."senderType" <> 'SEEKER' AND m."read"),
       MAX(m."createdAt") FILTER (WHERE m."deletedBySeeker"),
       NOW()
FROM "Application" a
JOIN "Message" m ON m."applicationId" = a."id"
WHERE a."userId" IS NOT NULL
GROUP BY a."id", a."userId"
ON CONFLICT ("applicationId", "userId") DO NOTHING;

-- Recruiter side: the legacy flag was shared by the whole company, so every member
-- (and the job poster) inherits it.
INSERT INTO "ConversationState" ("id", "applicationId", "userId", "lastReadAt", "clearedAt", "updatedAt")
SELECT gen_random_uuid()::text, x."applicationId", x."userId", MAX(x."lastReadAt"), MAX(x."clearedAt"), NOW()
FROM (
  SELECT a."id" AS "applicationId", u."userId",
         MAX(m."createdAt") FILTER (WHERE m."senderType" = 'SEEKER' AND m."read") AS "lastReadAt",
         MAX(m."createdAt") FILTER (WHERE m."deletedByRecruiter") AS "clearedAt"
  FROM "Application" a
  JOIN "Job" j ON j."id" = a."jobId"
  JOIN "Message" m ON m."applicationId" = a."id"
  JOIN (
    SELECT "companyId", "userId" FROM "CompanyMember"
    UNION
    SELECT "companyId", "recruiterId" AS "userId" FROM "Job"
  ) u ON u."companyId" = j."companyId"
  GROUP BY a."id", u."userId"
) x
GROUP BY x."applicationId", x."userId"
ON CONFLICT ("applicationId", "userId") DO NOTHING;

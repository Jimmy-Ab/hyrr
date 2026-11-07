-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedReason" TEXT;

-- Backfill: jobs an admin already removed (audit action job.remove) keep that decision.
UPDATE "Job" j
SET "removedAt" = a."createdAt",
    "removedReason" = COALESCE(a."meta"->>'reason', 'Removed by moderation')
FROM (
  SELECT DISTINCT ON ("target") "target", "createdAt", "meta"
  FROM "AuditLog" WHERE "action" = 'job.remove' ORDER BY "target", "createdAt" DESC
) a
WHERE a."target" = 'job:' || j."id" AND j."status" = 'CLOSED' AND j."removedAt" IS NULL;

-- Remove features that were never exposed in any UI (tracking links, e-mail templates,
-- interview availability) and legacy columns superseded by newer models.

-- Preserve the old single-text recruiter note as a regular ApplicationNote (authored by the
-- job poster) before dropping the column.
INSERT INTO "ApplicationNote" ("id", "applicationId", "authorId", "body", "createdAt")
SELECT gen_random_uuid()::text, a."id", j."recruiterId", a."notes", a."updatedAt"
FROM "Application" a
JOIN "Job" j ON j."id" = a."jobId"
WHERE a."notes" IS NOT NULL AND btrim(a."notes") <> '';

-- Message.deletedBySeeker / deletedByRecruiter were backfilled into ConversationState
-- (migration 20261104090000_messaging_ai) and are no longer read or written.

-- DropForeignKey
ALTER TABLE "ApplicationTrackingLink" DROP CONSTRAINT "ApplicationTrackingLink_applicationId_fkey";

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "notes";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "deletedByRecruiter",
DROP COLUMN "deletedBySeeker";

-- DropTable
DROP TABLE "ApplicationTrackingLink";

-- DropTable
DROP TABLE "CompanyEmailTemplate";

-- DropTable
DROP TABLE "InterviewAvailability";


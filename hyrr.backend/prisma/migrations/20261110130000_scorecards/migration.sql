-- CreateEnum
CREATE TYPE "ScorecardRecommendation" AS ENUM ('STRONG_YES', 'YES', 'NEUTRAL', 'NO', 'STRONG_NO');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "scorecardCompetencies" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "recommendation" "ScorecardRecommendation" NOT NULL,
    "overallNotes" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardRating" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ScorecardRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scorecard_applicationId_interviewerId_key" ON "Scorecard"("applicationId", "interviewerId");

-- CreateIndex
CREATE INDEX "ScorecardRating_scorecardId_idx" ON "ScorecardRating"("scorecardId");

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scorecard" ADD CONSTRAINT "Scorecard_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_score_range" CHECK (score BETWEEN 1 AND 5);

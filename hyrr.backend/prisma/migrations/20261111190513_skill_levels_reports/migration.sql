-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "SkillAssessment" ADD COLUMN     "difficulty" "SkillLevel" NOT NULL DEFAULT 'INTERMEDIATE';

-- AlterTable
ALTER TABLE "SkillQuestion" ADD COLUMN     "difficulty" "SkillLevel" NOT NULL DEFAULT 'INTERMEDIATE',
ADD COLUMN     "reportCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SkillQuestionReport" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillQuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEligibility" (
    "skill" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "testable" BOOLEAN NOT NULL,
    "reason" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillEligibility_pkey" PRIMARY KEY ("skill")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillQuestionReport_questionId_userId_key" ON "SkillQuestionReport"("questionId", "userId");

-- CreateIndex
CREATE INDEX "SkillQuestion_skill_difficulty_active_idx" ON "SkillQuestion"("skill", "difficulty", "active");

-- AddForeignKey
ALTER TABLE "SkillQuestionReport" ADD CONSTRAINT "SkillQuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SkillQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "SkillQuestion" (
    "id" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "questionIds" TEXT[],
    "answers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "score" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "SkillAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillQuestion_skill_active_idx" ON "SkillQuestion"("skill", "active");

-- CreateIndex
CREATE INDEX "SkillAssessment_userId_skill_idx" ON "SkillAssessment"("userId", "skill");

-- AddForeignKey
ALTER TABLE "SkillAssessment" ADD CONSTRAINT "SkillAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkillQuestion" ADD CONSTRAINT "SkillQuestion_options_check" CHECK (array_length(options, 1) BETWEEN 2 AND 6 AND "correctIndex" >= 0 AND "correctIndex" < array_length(options, 1));

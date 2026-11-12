-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'AI_SEEKER_TOOL';

-- CreateTable
CREATE TABLE "ResumeTailoring" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT,
    "cvUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeTailoring_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeTailoring_userId_jobId_key" ON "ResumeTailoring"("userId", "jobId");

-- AddForeignKey
ALTER TABLE "ResumeTailoring" ADD CONSTRAINT "ResumeTailoring_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeTailoring" ADD CONSTRAINT "ResumeTailoring_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;


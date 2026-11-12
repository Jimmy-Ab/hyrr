-- CreateEnum
CREATE TYPE "ExternalStage" AS ENUM ('BOOKMARKED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED');

-- CreateTable
CREATE TABLE "ExternalApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "location" TEXT,
    "stage" "ExternalStage" NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalApplication_userId_stage_idx" ON "ExternalApplication"("userId", "stage");

-- AddForeignKey
ALTER TABLE "ExternalApplication" ADD CONSTRAINT "ExternalApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


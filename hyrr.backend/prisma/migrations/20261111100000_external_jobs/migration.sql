-- CreateEnum
CREATE TYPE "ExternalJobSource" AS ENUM ('ADZUNA', 'JOOBLE', 'REMOTIVE', 'ARBEITNOW');

-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'EXTERNAL_APPLY';

-- AlterTable
ALTER TABLE "ExternalApplication" ADD COLUMN     "externalJobId" TEXT;

-- CreateTable
CREATE TABLE "ExternalJob" (
    "id" TEXT NOT NULL,
    "source" "ExternalJobSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "employmentType" TEXT,
    "category" TEXT,
    "postedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ExternalJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalJobApply" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalJobApply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalJob_active_postedAt_idx" ON "ExternalJob"("active", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalJob_source_sourceId_key" ON "ExternalJob"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalJobApply_userId_externalJobId_key" ON "ExternalJobApply"("userId", "externalJobId");

-- AddForeignKey
ALTER TABLE "ExternalApplication" ADD CONSTRAINT "ExternalApplication_externalJobId_fkey" FOREIGN KEY ("externalJobId") REFERENCES "ExternalJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalJobApply" ADD CONSTRAINT "ExternalJobApply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalJobApply" ADD CONSTRAINT "ExternalJobApply_externalJobId_fkey" FOREIGN KEY ("externalJobId") REFERENCES "ExternalJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;


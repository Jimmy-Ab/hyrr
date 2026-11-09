-- AlterEnum
ALTER TYPE "ApplicationSource" ADD VALUE 'OUTREACH';

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'SOURCED';

-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'OUTREACH';

-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "openToRecruiters" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openToRecruitersAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CompanyBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBlock_userId_companyId_key" ON "CompanyBlock"("userId", "companyId");

-- AddForeignKey
ALTER TABLE "CompanyBlock" ADD CONSTRAINT "CompanyBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBlock" ADD CONSTRAINT "CompanyBlock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SeekerProfile_openToRecruiters_idx" ON "SeekerProfile"("openToRecruiters") WHERE "openToRecruiters" = true;

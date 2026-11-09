-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('SENT', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdById" TEXT,
    "jobTitle" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "salaryCurrency" TEXT NOT NULL,
    "salaryPeriod" "SalaryPeriod" NOT NULL,
    "bonusAmount" INTEGER,
    "equityPercentage" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'SENT',
    "signatureName" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedIp" TEXT,
    "declineReason" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_applicationId_status_idx" ON "Offer"("applicationId", "status");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_amounts_check" CHECK ("baseSalary" > 0 AND ("bonusAmount" IS NULL OR "bonusAmount" >= 0) AND ("equityPercentage" IS NULL OR ("equityPercentage" >= 0 AND "equityPercentage" <= 100)));

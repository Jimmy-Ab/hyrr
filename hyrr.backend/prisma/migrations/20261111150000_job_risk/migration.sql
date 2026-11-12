-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "riskReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "riskScore" INTEGER;


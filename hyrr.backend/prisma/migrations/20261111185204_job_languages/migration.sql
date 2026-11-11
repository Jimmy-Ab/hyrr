-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY['English']::TEXT[];


-- CreateTable
CREATE TABLE "CompanyStats" (
    "companyId" TEXT NOT NULL,
    "applications30d" INTEGER NOT NULL DEFAULT 0,
    "medianFirstResponseHours" DOUBLE PRECISION,
    "reviewRate30d" DOUBLE PRECISION,
    "ghostRate30d" DOUBLE PRECISION,
    "fastResponder" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyStats_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE INDEX "CompanyStats_fastResponder_idx" ON "CompanyStats"("fastResponder");

-- AddForeignKey
ALTER TABLE "CompanyStats" ADD CONSTRAINT "CompanyStats_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


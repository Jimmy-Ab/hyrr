-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('YEAR', 'MONTH', 'HOUR');

-- AlterTable
ALTER TABLE "Education" ADD COLUMN     "endYear" INTEGER,
ADD COLUMN     "startYear" INTEGER;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "salaryCurrency" TEXT,
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "salaryPeriod" "SalaryPeriod";

-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "expectedSalaryCurrency" TEXT,
ADD COLUMN     "expectedSalaryMax" INTEGER,
ADD COLUMN     "expectedSalaryMin" INTEGER,
ADD COLUMN     "expectedSalaryPeriod" "SalaryPeriod";

-- AlterTable
ALTER TABLE "WorkExperience" ADD COLUMN     "current" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3);


-- ─── Hand-written backfills (best effort from the old free-text "duration") ───
-- Education "2015 - 2019" / "2018 – Present": first year → startYear, second year → endYear.
UPDATE "Education"
SET "startYear" = substring("duration" from '((?:19|20)\d{2})')::int,
    "endYear" = (regexp_match("duration", '(?:19|20)\d{2}\D+((?:19|20)\d{2})'))[1]::int
WHERE "duration" ~ '(19|20)\d{2}';

-- Work experience: first year → startDate (Jan 1), second year → endDate, "present/current/now" → current.
UPDATE "WorkExperience"
SET "startDate" = make_date(substring("duration" from '((?:19|20)\d{2})')::int, 1, 1),
    "endDate" = CASE
      WHEN "duration" ~* '(present|current|now|today)' THEN NULL
      ELSE make_date((regexp_match("duration", '(?:19|20)\d{2}\D+((?:19|20)\d{2})'))[1]::int, 1, 1)
    END,
    "current" = "duration" ~* '(present|current|now|today)'
WHERE "duration" ~ '(19|20)\d{2}';

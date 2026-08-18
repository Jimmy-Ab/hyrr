CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'REMOTE');

ALTER TABLE "Job"
  ALTER COLUMN "type" TYPE "EmploymentType"
  USING CASE "type"
    WHEN 'Full Time' THEN 'FULL_TIME'::"EmploymentType"
    WHEN 'Part Time' THEN 'PART_TIME'::"EmploymentType"
    WHEN 'Contract' THEN 'CONTRACT'::"EmploymentType"
    WHEN 'Remote' THEN 'REMOTE'::"EmploymentType"
    ELSE 'FULL_TIME'::"EmploymentType"
  END;

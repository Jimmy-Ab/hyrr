CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'RECRUITER', 'HIRING_MANAGER', 'VIEWER');
CREATE TYPE "AlertFrequency" AS ENUM ('INSTANT', 'DAILY', 'WEEKLY');

CREATE TABLE "CompanyMember" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "role" "CompanyMemberRole" NOT NULL DEFAULT 'RECRUITER', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScreeningQuestion" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "question" TEXT NOT NULL, "required" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScreeningQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScreeningAnswer" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "questionId" TEXT NOT NULL, "answer" TEXT NOT NULL,
  CONSTRAINT "ScreeningAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScreeningAnswer_applicationId_questionId_key" ON "ScreeningAnswer"("applicationId", "questionId");
ALTER TABLE "ScreeningQuestion" ADD CONSTRAINT "ScreeningQuestion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningAnswer" ADD CONSTRAINT "ScreeningAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningAnswer" ADD CONSTRAINT "ScreeningAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ScreeningQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CandidateLabel" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL DEFAULT 'purple', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateLabel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CandidateLabel_companyId_name_key" ON "CandidateLabel"("companyId", "name");
CREATE TABLE "ApplicationLabel" ("applicationId" TEXT NOT NULL, "labelId" TEXT NOT NULL, CONSTRAINT "ApplicationLabel_pkey" PRIMARY KEY ("applicationId", "labelId"));
CREATE TABLE "ApplicationNote" ("id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ApplicationStageEvent" ("id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "fromStatus" "ApplicationStatus", "toStatus" "ApplicationStatus" NOT NULL, "actorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ApplicationStageEvent_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ApplicationTrackingLink" ("id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ApplicationTrackingLink_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ApplicationTrackingLink_tokenHash_key" ON "ApplicationTrackingLink"("tokenHash");
ALTER TABLE "ApplicationLabel" ADD CONSTRAINT "ApplicationLabel_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationLabel" ADD CONSTRAINT "ApplicationLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "CandidateLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationStageEvent" ADD CONSTRAINT "ApplicationStageEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationTrackingLink" ADD CONSTRAINT "ApplicationTrackingLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JobAlert" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "keywords" TEXT[], "locations" TEXT[], "jobTypes" TEXT[], "minSalary" TEXT, "remoteOnly" BOOLEAN NOT NULL DEFAULT false, "frequency" "AlertFrequency" NOT NULL DEFAULT 'DAILY', "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "JobAlert_pkey" PRIMARY KEY ("id"));
CREATE TABLE "SavedSearch" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "query" TEXT, "filters" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id"));
CREATE TABLE "JobReport" ("id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "reporterId" TEXT NOT NULL, "reason" TEXT NOT NULL, "details" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "JobReport_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "JobReport_jobId_reporterId_key" ON "JobReport"("jobId", "reporterId");
CREATE TABLE "Subscription" ("id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "plan" TEXT NOT NULL DEFAULT 'Starter', "status" TEXT NOT NULL DEFAULT 'TRIAL', "provider" TEXT, "providerCustomerId" TEXT, "renewsAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");
ALTER TABLE "JobAlert" ADD CONSTRAINT "JobAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanyEmailTemplate" ("id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CompanyEmailTemplate_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "CompanyEmailTemplate_companyId_name_key" ON "CompanyEmailTemplate"("companyId", "name");
CREATE TABLE "InterviewAvailability" ("id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "jobId" TEXT NOT NULL, "createdById" TEXT NOT NULL, "startTime" TIMESTAMP(3) NOT NULL, "endTime" TIMESTAMP(3) NOT NULL, "meetingUrl" TEXT, "bookedApplicationId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InterviewAvailability_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "InterviewAvailability_bookedApplicationId_key" ON "InterviewAvailability"("bookedApplicationId");

-- CreateEnum
CREATE TYPE "InterviewInviteStatus" AS ENUM ('OPEN', 'BOOKED', 'CANCELED');

-- CreateTable
CREATE TABLE "InterviewInvite" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "location" TEXT,
    "meetingUrl" TEXT,
    "note" TEXT,
    "status" "InterviewInviteStatus" NOT NULL DEFAULT 'OPEN',
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSlot" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "bookedAt" TIMESTAMP(3),

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewInvite_eventId_key" ON "InterviewInvite"("eventId");

-- CreateIndex
CREATE INDEX "InterviewInvite_applicationId_status_idx" ON "InterviewInvite"("applicationId", "status");

-- CreateIndex
CREATE INDEX "InterviewSlot_inviteId_idx" ON "InterviewSlot"("inviteId");

-- AddForeignKey
ALTER TABLE "InterviewInvite" ADD CONSTRAINT "InterviewInvite_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewInvite" ADD CONSTRAINT "InterviewInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "InterviewInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;


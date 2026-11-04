-- Momentum credits, packages, plans and Stripe/Chapa payments.

-- Payment was never written by the application; any rows are mock data that cannot satisfy the
-- new required columns (companyId, providerRef). Subscription had no FK: drop orphans first.
DELETE FROM "Payment";
DELETE FROM "Subscription" s WHERE NOT EXISTS (SELECT 1 FROM "Company" c WHERE c."id" = s."companyId");

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'CHAPA');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('CREDIT_PACK', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'SIGNUP_BONUS', 'PLAN_GRANT', 'JOB_PUBLISH', 'JOB_FEATURE', 'AI_ANALYSIS', 'REFUND', 'ADJUSTMENT');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ALTER COLUMN "momentumCost" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "type",
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'CREDIT_PACK',
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "packageId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "providerRef" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "currency" DROP DEFAULT,
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "provider",
ADD COLUMN     "provider" "PaymentProvider" NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "renewsAt",
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "providerSubscriptionId" TEXT,
ALTER COLUMN "plan" SET DEFAULT 'STARTER',
DROP COLUMN "status",
ADD COLUMN     "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
DROP COLUMN "provider",
ADD COLUMN     "provider" "PaymentProvider";

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "momentumConfig" JSONB;

-- CreateTable
CREATE TABLE "CreditWallet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceId" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "priceUsdCents" INTEGER NOT NULL,
    "priceEtbCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "seatLimit" INTEGER,
    "priceUsdCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_companyId_key" ON "CreditWallet"("companyId");

-- CreateIndex
CREATE INDEX "CreditTransaction_companyId_createdAt_idx" ON "CreditTransaction"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_referenceId_idx" ON "CreditTransaction"("type", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPackage_code_key" ON "CreditPackage"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_companyId_createdAt_idx" ON "Payment"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Backfill & reference data ───────────────────────────────────────────────
UPDATE "Subscription" SET "plan" = upper("plan") WHERE "plan" IS NOT NULL;

-- Jobs that are already live were published before Momentum existed: never charge them.
UPDATE "Job" SET "publishedAt" = "createdAt" WHERE "status" IN ('ACTIVE', 'CLOSED', 'FLAGGED');
-- Existing free "featured" flags get a 14-day window from creation; expired ones are cleared.
UPDATE "Job" SET "featuredUntil" = "createdAt" + INTERVAL '14 days' WHERE "featured" = true;
UPDATE "Job" SET "featured" = false WHERE "featured" = true AND "featuredUntil" < NOW();

-- Credit packages (USD prices from the product spec; ETB prices are an initial conversion,
-- adjust them in the CreditPackage table).
INSERT INTO "CreditPackage" ("id", "code", "name", "credits", "bonusCredits", "priceUsdCents", "priceEtbCents", "active", "sortOrder") VALUES
  (gen_random_uuid()::text, 'STARTER',      'Starter Bundle',     100,   0,  1999,  299900, true, 1),
  (gen_random_uuid()::text, 'PROFESSIONAL', 'Professional Pack',  300,  50,  4999,  749900, true, 2),
  (gen_random_uuid()::text, 'ENTERPRISE',   'Enterprise Pool',   1000, 200, 14999, 2249900, true, 3);

INSERT INTO "Plan" ("id", "code", "name", "monthlyCredits", "seatLimit", "priceUsdCents", "active", "sortOrder") VALUES
  (gen_random_uuid()::text, 'STARTER',    'Starter',       0,    3,     0, true, 1),
  (gen_random_uuid()::text, 'PRO',        'Pro',         300,   10,  9900, true, 2),
  (gen_random_uuid()::text, 'ENTERPRISE', 'Enterprise', 1200, NULL, 29900, true, 3);

-- Every existing company gets a wallet with the 20-credit sign-up bonus, recorded in the ledger.
INSERT INTO "CreditWallet" ("id", "companyId", "balance", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 20, NOW(), NOW() FROM "Company" c
ON CONFLICT ("companyId") DO NOTHING;
INSERT INTO "CreditTransaction" ("id", "companyId", "amount", "type", "balanceAfter", "note", "createdAt")
SELECT gen_random_uuid()::text, w."companyId", 20, 'SIGNUP_BONUS', 20, 'Welcome bonus', NOW() FROM "CreditWallet" w;

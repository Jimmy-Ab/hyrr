-- CreateEnum
CREATE TYPE "CreditAudience" AS ENUM ('RECRUITER', 'SEEKER');

-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'APPLICATION';

-- AlterTable
ALTER TABLE "CreditPackage" ADD COLUMN     "audience" "CreditAudience" NOT NULL DEFAULT 'RECRUITER';

-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CreditWallet" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "companyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "CreditWallet"("userId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Hand-written: owner integrity, seeker packs, seeker wallets ──────────────
-- A wallet belongs to exactly one company or one user.
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_one_owner"
  CHECK (("companyId" IS NOT NULL) <> ("userId" IS NOT NULL));

-- Seeker credit packs (1 credit = 1 application).
INSERT INTO "CreditPackage" ("id", "code", "name", "audience", "credits", "bonusCredits", "priceUsdCents", "priceEtbCents", "active", "sortOrder") VALUES
  (gen_random_uuid()::text, 'SEEKER_STARTER', 'Job Hunt Starter', 'SEEKER', 10,  0,  299,  44900, true, 11),
  (gen_random_uuid()::text, 'SEEKER_ACTIVE',  'Active Search',    'SEEKER', 30,  5,  799, 119900, true, 12),
  (gen_random_uuid()::text, 'SEEKER_PRO',     'Career Move',      'SEEKER', 75, 15, 1699, 254900, true, 13)
ON CONFLICT ("code") DO NOTHING;

-- Every existing seeker starts with the 10-credit welcome bonus.
INSERT INTO "CreditWallet" ("id", "userId", "balance", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 10, NOW(), NOW() FROM "User" u WHERE u."role" = 'SEEKER'
ON CONFLICT ("userId") DO NOTHING;
INSERT INTO "CreditTransaction" ("id", "userId", "amount", "type", "balanceAfter", "note", "createdAt")
SELECT gen_random_uuid()::text, w."userId", 10, 'SIGNUP_BONUS', 10, 'Welcome bonus', NOW()
FROM "CreditWallet" w WHERE w."userId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "CreditTransaction" t WHERE t."userId" = w."userId" AND t."type" = 'SIGNUP_BONUS');

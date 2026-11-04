-- CreateEnum
CREATE TYPE "EmbeddingKind" AS ENUM ('JOB', 'PROFILE');

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "kind" "EmbeddingKind" NOT NULL,
    "refId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_kind_refId_key" ON "Embedding"("kind", "refId");


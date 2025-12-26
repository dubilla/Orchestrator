/*
  Warnings:

  - The values [TODO,IN_REVIEW] on the enum `BacklogItemStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [INACTIVE] on the enum `OrchestraStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `assignedAgentId` on the `backlog_items` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
-- First, transform data to use values that exist in both old and new enums
UPDATE "backlog_items" SET "status" = 'IN_PROGRESS' WHERE "status" = 'IN_REVIEW';
-- Note: TODO will be mapped to QUEUED below via the USING clause

CREATE TYPE "BacklogItemStatus_new" AS ENUM ('QUEUED', 'IN_PROGRESS', 'PR_OPEN', 'DONE', 'FAILED');
ALTER TABLE "public"."backlog_items" ALTER COLUMN "status" DROP DEFAULT;
-- Map old values to new values during type conversion
ALTER TABLE "backlog_items" ALTER COLUMN "status" TYPE "BacklogItemStatus_new" USING (
  CASE "status"::text
    WHEN 'TODO' THEN 'QUEUED'
    ELSE "status"::text
  END::"BacklogItemStatus_new"
);
ALTER TYPE "BacklogItemStatus" RENAME TO "BacklogItemStatus_old";
ALTER TYPE "BacklogItemStatus_new" RENAME TO "BacklogItemStatus";
DROP TYPE "public"."BacklogItemStatus_old";
ALTER TABLE "backlog_items" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrchestraStatus_new" AS ENUM ('ACTIVE', 'PAUSED');
ALTER TABLE "public"."orchestras" ALTER COLUMN "status" DROP DEFAULT;
-- Map INACTIVE to PAUSED during type conversion
ALTER TABLE "orchestras" ALTER COLUMN "status" TYPE "OrchestraStatus_new" USING (
  CASE "status"::text
    WHEN 'INACTIVE' THEN 'PAUSED'
    ELSE "status"::text
  END::"OrchestraStatus_new"
);
ALTER TYPE "OrchestraStatus" RENAME TO "OrchestraStatus_old";
ALTER TYPE "OrchestraStatus_new" RENAME TO "OrchestraStatus";
DROP TYPE "public"."OrchestraStatus_old";
ALTER TABLE "orchestras" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "backlog_items" DROP CONSTRAINT "backlog_items_assignedAgentId_fkey";

-- AlterTable
ALTER TABLE "backlog_items" DROP COLUMN "assignedAgentId",
ADD COLUMN     "prNumber" INTEGER,
ADD COLUMN     "prUrl" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "orchestras" ADD COLUMN     "githubRemote" TEXT,
ADD COLUMN     "wipLimit" INTEGER NOT NULL DEFAULT 2;

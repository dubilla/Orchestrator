-- AlterTable
ALTER TABLE "orchestras" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncedHash" TEXT;

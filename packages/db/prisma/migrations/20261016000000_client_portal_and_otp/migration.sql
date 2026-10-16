-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('DESIGNER', 'CLIENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InviteDirection" AS ENUM ('INVITE', 'REQUEST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'DESIGNER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "title" TEXT;

-- AlterTable ProjectMember
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canViewFiles" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canDownloadFiles" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canViewBrief" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canComment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canApproveVersions" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable EmailOtp
CREATE TABLE IF NOT EXISTS "EmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProjectInvite
CREATE TABLE IF NOT EXISTS "ProjectInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "invitedById" TEXT,
    "direction" "InviteDirection" NOT NULL DEFAULT 'INVITE',
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "canViewFiles" BOOLEAN NOT NULL DEFAULT true,
    "canDownloadFiles" BOOLEAN NOT NULL DEFAULT false,
    "canViewBrief" BOOLEAN NOT NULL DEFAULT true,
    "canComment" BOOLEAN NOT NULL DEFAULT true,
    "canApproveVersions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailOtp_email_purpose_key" ON "EmailOtp"("email", "purpose");
CREATE INDEX IF NOT EXISTS "EmailOtp_email_purpose_idx" ON "EmailOtp"("email", "purpose");
CREATE INDEX IF NOT EXISTS "ProjectInvite_projectId_status_idx" ON "ProjectInvite"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProjectInvite_email_status_idx" ON "ProjectInvite"("email", "status");
CREATE INDEX IF NOT EXISTS "ProjectInvite_userId_status_idx" ON "ProjectInvite"("userId", "status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

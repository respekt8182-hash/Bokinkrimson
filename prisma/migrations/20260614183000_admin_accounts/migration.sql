CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE');

CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatarStorageKey" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "disabledById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminAccount_login_key" ON "AdminAccount"("login");
CREATE UNIQUE INDEX "AdminAccount_email_key" ON "AdminAccount"("email");
CREATE INDEX "AdminAccount_status_role_createdAt_idx" ON "AdminAccount"("status", "role", "createdAt");
CREATE INDEX "AdminAccount_createdById_createdAt_idx" ON "AdminAccount"("createdById", "createdAt");
CREATE INDEX "AdminAccount_disabledAt_idx" ON "AdminAccount"("disabledAt");

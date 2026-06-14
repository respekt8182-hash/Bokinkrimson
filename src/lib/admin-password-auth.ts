import bcrypt from "bcryptjs";
import { normalizeAdminRole, type AdminRoleValue } from "@/lib/admin-rbac";
import { db } from "@/lib/db";
import { isDatabaseSchemaMissingError } from "@/lib/prisma-errors";
import { getAdminLoginValue, getAdminPasswordHashValue } from "@/lib/security-config";

export type AdminCredentialResult =
  | {
      authProvider: "env";
      login: string;
      sessionVersion: number;
      adminAccountId: null;
      displayName: string;
      avatarUrl: null;
      role: AdminRoleValue;
      mustChangePassword: false;
    }
  | {
      authProvider: "database";
      login: string;
      sessionVersion: number;
      adminAccountId: string;
      displayName: string;
      avatarUrl: string | null;
      role: AdminRoleValue;
      mustChangePassword: boolean;
    };

async function findActiveAdminAccount(login: string) {
  return db.adminAccount
    .findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ login }, { email: login }],
      },
      select: {
        id: true,
        login: true,
        passwordHash: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        sessionVersion: true,
        mustChangePassword: true,
      },
    })
    .catch((error) => {
      if (isDatabaseSchemaMissingError(error)) {
        return null;
      }

      return null;
    });
}

export async function authenticateAdminCredentials(
  login: string,
  password: string,
): Promise<AdminCredentialResult | null> {
  const normalizedLogin = login.trim();
  const account = await findActiveAdminAccount(normalizedLogin);

  if (account && (await bcrypt.compare(password, account.passwordHash))) {
    return {
      authProvider: "database",
      login: account.login,
      sessionVersion: account.sessionVersion,
      adminAccountId: account.id,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      role: normalizeAdminRole(account.role),
      mustChangePassword: account.mustChangePassword,
    };
  }

  if (normalizedLogin !== getAdminLoginValue()) {
    return null;
  }

  const isEnvPasswordValid = await bcrypt.compare(password, getAdminPasswordHashValue());
  if (!isEnvPasswordValid) {
    return null;
  }

  return {
    authProvider: "env",
    login: normalizedLogin,
    sessionVersion: 0,
    adminAccountId: null,
    displayName: "Администратор",
    avatarUrl: null,
    role: "SUPER_ADMIN",
    mustChangePassword: false,
  };
}

export async function validateAdminCredentials(login: string, password: string): Promise<boolean> {
  return (await authenticateAdminCredentials(login, password)) !== null;
}

import bcrypt from "bcryptjs";
import {
  getAdminLoginValue,
  getAdminPasswordHashValue,
} from "@/lib/security-config";

export async function validateAdminCredentials(
  login: string,
  password: string,
): Promise<boolean> {
  if (login !== getAdminLoginValue()) {
    return false;
  }

  return bcrypt.compare(password, getAdminPasswordHashValue());
}

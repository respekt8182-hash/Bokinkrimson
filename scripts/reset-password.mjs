/**
 * CLI utility: reset a user's password directly in the database.
 *
 * Usage:
 *   node scripts/reset-password.mjs <email> <newPassword>
 *
 * Example:
 *   node scripts/reset-password.mjs gavrisuk.a.pi.21@gmail.com MyNewPass123!
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error("Usage: node scripts/reset-password.mjs <email> <newPassword>");
  console.error("Example: node scripts/reset-password.mjs admin@example.com NewPass123!");
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error("Error: password must be at least 8 characters.");
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  if (!user) {
    console.error(`Error: user with email "${email}" not found.`);
    await db.$disconnect();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  console.log(`\nPassword reset successfully:`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Name:  ${user.firstName} ${user.lastName}`);
  console.log(`  Role:  ${user.role}`);
  console.log(`  Login URL: http://localhost:3000/auth/login`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});

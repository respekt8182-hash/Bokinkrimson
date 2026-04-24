import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-admin-password.mjs "YourStrongAdminPassword"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);

console.log("Bcrypt hash:");
console.log(hash);
console.log("");
console.log("Escaped for .env files:");
console.log(hash.replace(/\$/g, "\\$"));

/**
 * Run with: npx tsx scripts/seed-admin.ts
 * Creates the admin user in your Neon database.
 * Requires DATABASE_URL in .env.local
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "../lib/db";

const EMAIL    = process.env.ADMIN_EMAIL    ?? "mosesndereba06@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Moses106371$";
const NAME     = process.env.ADMIN_NAME     ?? "Moses";

async function main() {
  console.log(`Seeding admin: ${EMAIL}`);

  const existing = await getUserByEmail(EMAIL);
  if (existing) {
    console.log("User already exists:", existing.id, "role:", existing.role);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await createUser({ email: EMAIL, name: NAME, passwordHash, role: "admin" });
  console.log("Created admin user:", user.id);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

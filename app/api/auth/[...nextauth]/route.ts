import { handlers } from "@/auth";

// Next.js 15 / NextAuth v5 — export handlers directly.
// runtime must be nodejs (not edge) because auth.ts imports bcrypt and fs.
export const runtime = "nodejs";
export const { GET, POST } = handlers;

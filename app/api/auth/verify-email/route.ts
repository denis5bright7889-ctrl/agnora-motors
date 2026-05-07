import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailCode, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!isDbConfigured()) {
      // Local users are always "verified" — no DB to check
      return NextResponse.json({ ok: true });
    }

    const ok = await verifyEmailCode(parsed.data.email, parsed.data.code);
    if (!ok) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

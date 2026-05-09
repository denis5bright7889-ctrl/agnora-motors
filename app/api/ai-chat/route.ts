import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSubscription, isDbConfigured } from "@/lib/db";
import { canUseAiChat } from "@/lib/subscriptions";
import { DEALER_SYSTEM_PROMPT, streamGroqChat } from "@/lib/ai";

export const runtime     = "nodejs";
export const maxDuration = 60;

// Keep last 20 turns to stay within token budget
const MAX_HISTORY   = 20;
const MAX_MSG_CHARS = 4_000;

export async function POST(req: Request) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { role } = session.user;

  // Only dealers, private sellers, and admins can use the dealer AI assistant
  if (role !== "dealer" && role !== "private_seller" && role !== "admin") {
    return NextResponse.json(
      { error: "AI assistant is available for dealers and sellers only." },
      { status: 403 },
    );
  }

  // ── 2. Subscription gate (admins bypass) ───────────────────────────────────
  if (role !== "admin" && isDbConfigured()) {
    try {
      const sub   = await getSubscription(session.user.id);
      const planId = (sub?.plan ?? "free") as "free" | "pro" | "premium";
      const gate  = canUseAiChat(planId);
      if (!gate.allowed) {
        return NextResponse.json(
          { error: gate.reason ?? "AI chat requires a Pro or Premium plan." },
          { status: 403 },
        );
      }
    } catch {
      // DB check failed — fail open so the UX isn't broken
    }
  }

  // ── 3. Parse + sanitise body ───────────────────────────────────────────────
  let body: {
    messages?:   { role: "user" | "assistant"; content: string }[];
    dealerCtx?:  Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawMessages = body.messages ?? [];

  if (!rawMessages.length) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const messages = rawMessages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role:    m.role,
      content: m.content.trim().slice(0, MAX_MSG_CHARS),
    }));

  const last = messages.at(-1);
  if (last?.role !== "user" || !last?.content) {
    return NextResponse.json({ error: "Last message must be a non-empty user message" }, { status: 400 });
  }

  // ── 4. Build Groq message list ─────────────────────────────────────────────
  // Groq uses the OpenAI messages format: system message first, then history.
  let systemText = DEALER_SYSTEM_PROMPT;
  if (body.dealerCtx && Object.keys(body.dealerCtx).length > 0) {
    systemText += `\n\n<dealer_context>\n${JSON.stringify(body.dealerCtx, null, 2)}\n</dealer_context>`;
  }

  const groqMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemText },
    ...messages,
  ];

  // ── 5. Stream from Groq (free tier, llama-3.3-70b) ────────────────────────
  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        await streamGroqChat(groqMessages, controller, encoder);
        console.log("[ai-chat] GROQ stream complete userId=%s role=%s", session.user.id, role);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[ai-chat] Groq error:", msg);
        const friendly = msg.includes("GROQ_API_KEY") || msg.includes("401")
          ? "AI service is not configured. Add GROQ_API_KEY to your environment variables."
          : "I ran into a temporary error — please try again.";
        controller.enqueue(encoder.encode(friendly));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type":      "text/plain; charset=utf-8",
      "Cache-Control":     "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

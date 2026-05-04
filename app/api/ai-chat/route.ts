import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { getSubscription, isDbConfigured } from "@/lib/db";
import { canUseAiChat } from "@/lib/subscriptions";

export const runtime = "nodejs";

const anthropic = new Anthropic();

// Stable system prompt — cached with ephemeral cache_control (5-min TTL)
const SYSTEM_PROMPT = `You are an AI car buying assistant for Agnora Motors, Kenya's premier car marketplace. Help buyers make confident, informed decisions.

You can:
- Answer questions about specific car listings (year, make, mileage, condition, features, price)
- Explain technical details in plain language (engine specs, fuel types, transmission, body types)
- Advise what to check on a test drive and what warning signs to watch for
- Give context on Kenyan market pricing, common models, and import history
- Help buyers understand financing or hire-purchase options
- Facilitate connecting the buyer with the seller or dealer

When car or seller details are provided in the context, reference them specifically.
Be friendly, honest, and concise. Encourage in-person inspection and mention Agnora's verified inspection service for peace of mind.
If you don't have enough information to answer accurately, say so and suggest the buyer contact the seller directly.`;

export async function POST(req: Request) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Plan gate — AI chat requires Pro or Premium
  if (isDbConfigured()) {
    try {
      const sub = await getSubscription(session.user.id);
      const planId = (sub?.plan ?? "free") as "free" | "pro" | "premium";
      const gate = canUseAiChat(planId);
      if (!gate.allowed) {
        return NextResponse.json(
          { error: gate.reason ?? "AI chat requires a Pro or Premium plan." },
          { status: 403 },
        );
      }
    } catch {
      // DB check failed — fail open so UX isn't broken
    }
  }

  let body: {
    messages?: { role: "user" | "assistant"; content: string }[];
    carDetails?: Record<string, unknown>;
    sellerInfo?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, carDetails, sellerInfo } = body;

  if (!messages?.length) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  // Build system content — stable prompt cached, dynamic context not cached
  const systemContent: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (carDetails || sellerInfo) {
    const parts: string[] = [];
    if (carDetails) {
      parts.push(`<car_listing>\n${JSON.stringify(carDetails, null, 2)}\n</car_listing>`);
    }
    if (sellerInfo) {
      parts.push(`<seller_info>\n${JSON.stringify(sellerInfo, null, 2)}\n</seller_info>`);
    }
    systemContent.push({ type: "text", text: parts.join("\n\n") });
  }

  // Stream the response from Claude Haiku 4.5
  const claudeStream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemContent as Anthropic.TextBlockParam[],
    messages: messages as Anthropic.MessageParam[],
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      claudeStream.abort();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

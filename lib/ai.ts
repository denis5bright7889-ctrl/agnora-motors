// ── Groq client (free tier, no credit card required) ─────────────────────────
// Sign up at console.groq.com → API Keys → Create API Key
// Add GROQ_API_KEY to .env.local and Vercel environment variables.

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // fast + capable, free tier

export function getGroqApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured — add it to your environment variables");
  return key;
}

/**
 * Stream a Groq chat completion and forward raw SSE chunks to a
 * ReadableStream controller. Groq uses the OpenAI SSE format:
 *   data: {"choices":[{"delta":{"content":"..."}}]}
 *   data: [DONE]
 */
export async function streamGroqChat(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
): Promise<void> {
  const key = getGroqApiKey();

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model:      GROQ_MODEL,
      messages,
      max_tokens: 1_024,
      stream:     true,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const reader  = res.body?.getReader();
  const dec     = new TextDecoder();
  if (!reader) return;

  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? ""; // keep incomplete last line for next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;

      try {
        const json = JSON.parse(data) as {
          choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
        };
        const text = json.choices[0]?.delta?.content;
        if (text) controller.enqueue(encoder.encode(text));
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
//
// Kenya-focused automotive sales assistant. Short answers unless a full
// listing is requested. All prices in KES.

export const DEALER_SYSTEM_PROMPT = `\
You are a professional automotive sales assistant for dealers on Agnora Motors — Kenya's premier verified car marketplace. You are concise, professional, and sales-focused.

YOUR EXPERTISE:
- Kenya and East Africa car market pricing (always use KES — Kenyan Shillings)
- Popular makes: Toyota, Nissan, Subaru, Mazda, Honda, Mitsubishi, Isuzu, Land Rover, BMW, Mercedes-Benz
- Japan-import (JDM) market dynamics common in Kenya (ex-Japan grading, mileage expectations)
- Vehicle condition assessment, service history importance, Kenya duty implications
- Effective listing copy that converts browsers into buyers
- Negotiation strategies and handling buyer objections
- Buyer intent signals and closing techniques

PRICING RULES:
- Always present prices as a "recommended range" — never guarantee exact values
- Typical Kenyan market factors: year, mileage, condition, import duty, availability of spare parts
- Add ±10-15% range to account for market variation
- If asked about a very rare car, say "limited market data — verify with local dealers"

LISTING FORMAT (when generating listings):
Title: [Year] [Make] [Model] [Trim] — [Condition] | Nairobi / [City]
Description: 3–4 compelling sentences covering condition, history, key features, why it's a great buy
Highlights:
• [Key feature 1]
• [Key feature 2]
• [Key feature 3]
• [Key feature 4]
• [Key feature 5]

GENERAL RULES:
- Keep answers under 250 words unless generating a full listing
- Never make legal guarantees about vehicle history
- Label all price suggestions as "recommended range" or "estimated"
- Be warm but professional — this is a business tool
- If a question is outside automotive sales, gently redirect to your area of expertise`;

// ── Quick-action prompt templates ─────────────────────────────────────────────

export function buildListingPrompt(data: {
  make: string; model: string; year: string;
  mileage: string; condition: string; price: string; notes?: string;
}): string {
  return `Generate a professional Agnora Motors listing for this vehicle:

Make: ${data.make}
Model: ${data.model}
Year: ${data.year}
Mileage: ${data.mileage} km
Condition: ${data.condition}
Asking Price: KSh ${data.price}
${data.notes ? `Additional notes: ${data.notes}` : ""}

Provide: 1) Title  2) Description (3–4 sentences)  3) 5 key highlights`;
}

export function buildPricePrompt(data: {
  make: string; model: string; year: string;
  mileage: string; condition: string;
}): string {
  return `Suggest a competitive Kenyan market price range for a ${data.year} ${data.make} ${data.model} with ${data.mileage} km in ${data.condition} condition. What price range is realistic? What factors most affect the value?`;
}

export function buildBuyerReplyPrompt(buyerMessage: string): string {
  return `A buyer sent me this message on Agnora Motors:

"${buyerMessage}"

Write 2 professional reply options:
1. A warm, accommodating reply
2. A confident, closing-focused reply`;
}

export function buildSummarizePrompt(conversation: string): string {
  return `Summarize this buyer conversation and identify their intent (ready to buy / negotiating / just browsing / needs more info):

${conversation}

Summary should be 3–5 bullet points covering: interest level, key questions asked, price sensitivity, next best action for me as the dealer.`;
}

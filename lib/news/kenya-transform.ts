import Anthropic from "@anthropic-ai/sdk";
import type { ImpactResult } from "./impact";

// Kenya-impact overlay: takes a raw global article + its deterministic impact
// score, returns four short paragraphs answering the questions a Kenyan car
// buyer actually has. Skipped for "low" impact articles to save tokens (those
// render with only the standard summary and no overlay widget).
//
// Model: Haiku 4.5. This is a summarization task — Sonnet's extra reasoning
// isn't worth the 12x cost at ingest-time scale. See the discussion in
// memory; if quality drops, swap the model id below.

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface KenyaSummary {
  whatHappened:         string;
  whyGlobal:            string;
  whyKenya:             string;
  whatBuyersShouldDo:   string;
}

const SYSTEM = `You are the Kenya market editor for Agnora Motors, Kenya's car-buying intelligence platform.
Your job is to translate global automotive news into concrete relevance for Kenyan car buyers.
Kenyan import context: most cars arrive used from Japan (Toyota, Subaru, Mazda, Nissan, Honda dominate);
hybrids are growing fast; diesel pickups and SUVs are staples; spare parts availability and resale value
matter more than headline horsepower; new-car launches typically reach Kenya 1-3 years after global release.
Write in plain, direct English. No hype. No "may", "could", "potentially" hedging more than once per field.`;

export async function generateKenyaSummary(
  title:    string,
  body:     string,
  impact:   ImpactResult,
): Promise<KenyaSummary | null> {
  if (!process.env.ANTHROPIC_API_KEY)        return null;
  if (impact.score === "low")                return null;
  if (!body || body.length < 80)             return null;

  const brandHint = impact.matchedBrands.length
    ? `\nBrands mentioned: ${impact.matchedBrands.join(", ")}`
    : "";
  const segmentHint = impact.matchedSegments.length
    ? `\nSegments: ${impact.matchedSegments.join(", ")}`
    : "";

  try {
    const result = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Return ONLY a JSON object with these exact fields, no markdown:
{
  "whatHappened":       "1-2 sentences, factual, no speculation",
  "whyGlobal":          "1-2 sentences on why this matters in the global market",
  "whyKenya":           "2-3 sentences on concrete implications for Kenyan buyers (import availability, fuel costs, resale, spare parts, segments most affected)",
  "whatBuyersShouldDo": "1 sentence of practical action (e.g. 'Wait 12 months for prices to settle', 'Consider buying a 2020-2023 model before the new generation arrives', or 'No action needed — Kenyan market unlikely to see this model')"
}

Title: ${title}${brandHint}${segmentHint}
Article: ${body.slice(0, 2000)}`,
        },
      ],
    });

    const text = result.content[0].type === "text" ? result.content[0].text.trim() : "{}";
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(clean) as Partial<KenyaSummary>;

    if (!parsed.whatHappened || !parsed.whyKenya) return null;
    return {
      whatHappened:       String(parsed.whatHappened),
      whyGlobal:          String(parsed.whyGlobal          ?? ""),
      whyKenya:           String(parsed.whyKenya),
      whatBuyersShouldDo: String(parsed.whatBuyersShouldDo ?? ""),
    };
  } catch {
    // Transform failures must never break the ingest cron.
    return null;
  }
}

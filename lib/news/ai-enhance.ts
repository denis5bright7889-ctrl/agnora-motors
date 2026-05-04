import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

interface Enhancement {
  summary: string;
  tags: string[];
  category: string;
}

const ENHANCE_SYSTEM = `You are an automotive news editor for Agnora Motors, Kenya's leading car marketplace.
Your audience is Kenyan car buyers, dealers, and automotive enthusiasts.
When given an article, extract a summary and relevant tags that resonate with East African car culture.`;

export async function enhanceArticle(
  title: string,
  content: string,
  scope: string,
): Promise<Enhancement> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { summary: content.slice(0, 300), tags: [], category: scope };
  }

  try {
    const result = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: ENHANCE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Analyze this automotive article and return a JSON object ONLY with these exact fields:
{
  "summary": "2-3 sentence summary relevant to Kenyan car buyers",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "one of: kenya|east-africa|africa|ev|suv|luxury|hybrid|policy|pricing|global"
}

Title: ${title}
Content: ${content.slice(0, 1500)}

Return ONLY the JSON object, no markdown, no explanation.`,
        },
      ],
    });

    const text = result.content[0].type === "text" ? result.content[0].text.trim() : "{}";
    // Strip markdown code blocks if present
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(clean) as Partial<Enhancement>;
    return {
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
      category: parsed.category ?? scope,
    };
  } catch {
    return { summary: content.slice(0, 300), tags: [], category: scope };
  }
}

export async function generateResearchSeo(
  title: string,
  excerpt: string,
): Promise<{ seoTitle: string; seoDescription: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { seoTitle: title, seoDescription: excerpt.slice(0, 160) };
  }
  try {
    const result = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Write SEO metadata for this automotive article targeting Kenyan car buyers.
Return JSON only: { "seoTitle": "under 60 chars", "seoDescription": "under 160 chars" }

Title: ${title}
Excerpt: ${excerpt.slice(0, 300)}`,
        },
      ],
    });
    const text = result.content[0].type === "text" ? result.content[0].text.trim() : "{}";
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(clean) as { seoTitle?: string; seoDescription?: string };
    return {
      seoTitle: parsed.seoTitle ?? title,
      seoDescription: parsed.seoDescription ?? excerpt.slice(0, 160),
    };
  } catch {
    return { seoTitle: title, seoDescription: excerpt.slice(0, 160) };
  }
}

import { NextResponse } from "next/server";
import { getNewsArticles, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

// ── Static fallback (shown when DB is not yet populated) ────────────────────
const STATIC_NEWS = [
  {
    id: "n-static-1",
    title: "Kenya's EV Market Grows 340% — What's Driving the Surge?",
    slug: "kenya-ev-market-grows-340-2025-04-18-static1",
    source: "Business Daily Africa",
    sourceUrl: "https://businessdailyafrica.com",
    country: "ke",
    category: "kenya",
    content: null,
    summary: "Import duty exemptions and new charging infrastructure along the Nairobi-Mombasa highway are accelerating electric vehicle adoption across Kenya.",
    image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80",
    url: "#",
    urlHash: "static1",
    titleHash: "static1",
    publishedAt: "2025-04-18T11:00:00Z",
    tags: ["Kenya", "EV", "electric vehicles"],
    status: "published" as const,
    featured: true,
    viewCount: 0,
    createdAt: "2025-04-18T11:00:00Z",
  },
  {
    id: "n-static-2",
    title: "Toyota Land Cruiser 300 Series: Why It Still Dominates East Africa",
    slug: "toyota-land-cruiser-300-east-africa-2025-04-22-static2",
    source: "Kenyan Motor",
    sourceUrl: "https://kenyanmotor.com",
    country: "ea",
    category: "east-africa",
    content: null,
    summary: "From Nairobi's CBD to the Maasai Mara, the LC300 continues to be the go-to choice for reliability and off-road capability in East Africa.",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
    url: "#",
    urlHash: "static2",
    titleHash: "static2",
    publishedAt: "2025-04-22T07:00:00Z",
    tags: ["Toyota", "Land Cruiser", "SUV", "East Africa"],
    status: "published" as const,
    featured: false,
    viewCount: 0,
    createdAt: "2025-04-22T07:00:00Z",
  },
  {
    id: "n-static-3",
    title: "2025 Mazda CX-5 Hybrid: The Import That Makes Sense for Kenya",
    slug: "mazda-cx5-hybrid-kenya-2025-04-12-static3",
    source: "Kenyan Motor",
    sourceUrl: "https://kenyanmotor.com",
    country: "ke",
    category: "kenya",
    content: null,
    summary: "Mazda's refined CX-5 hybrid now offers fuel economy of 5.8L/100km, making it one of the most cost-efficient imports for Kenyan roads.",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    url: "#",
    urlHash: "static3",
    titleHash: "static3",
    publishedAt: "2025-04-12T08:30:00Z",
    tags: ["Mazda", "Hybrid", "Kenya", "Import"],
    status: "published" as const,
    featured: false,
    viewCount: 0,
    createdAt: "2025-04-12T08:30:00Z",
  },
  {
    id: "n-static-4",
    title: "BMW i5 M60: 601 HP Electric Performance Saloon",
    slug: "bmw-i5-m60-electric-2025-04-25-static4",
    source: "Car Magazine",
    sourceUrl: "https://carmagazine.co.uk",
    country: "global",
    category: "ev",
    content: null,
    summary: "BMW's latest EV flagship combines M division performance with zero-emission driving — 0-100 km/h in 3.8 seconds.",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    url: "#",
    urlHash: "static4",
    titleHash: "static4",
    publishedAt: "2025-04-25T10:30:00Z",
    tags: ["BMW", "EV", "Electric", "Performance"],
    status: "published" as const,
    featured: false,
    viewCount: 0,
    createdAt: "2025-04-25T10:30:00Z",
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const country  = searchParams.get("country") ?? undefined;
  const search   = searchParams.get("search") ?? undefined;
  const limit    = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const offset   = Number(searchParams.get("offset") ?? 0);

  if (isDbConfigured()) {
    try {
      const articles = await getNewsArticles({ category, country, search, limit, offset });
      if (articles.length > 0) {
        return NextResponse.json({ articles, source: "db" });
      }
    } catch {
      // fall through to static
    }
  }

  // Static fallback — filter by category/country if requested
  let filtered = STATIC_NEWS as typeof STATIC_NEWS;
  if (category && category !== "all") {
    filtered = filtered.filter((a) => a.category === category);
  }
  if (country && country !== "all") {
    filtered = filtered.filter((a) => a.country === country);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.summary ?? "").toLowerCase().includes(q),
    );
  }

  return NextResponse.json({ articles: filtered.slice(offset, offset + limit), source: "static" });
}

import type { NewsArticle } from "@/types";

// Static fallback shown when the DB is not yet populated (e.g. before the news
// pipeline has run). Shared by both the list route (/api/news) and the detail
// route (/api/news/[slug]) so a card on the list always resolves to a real
// article page instead of a 404.
export const STATIC_NEWS: NewsArticle[] = [
  {
    id: "n-static-1",
    title: "Kenya's EV Market Grows 340% — What's Driving the Surge?",
    slug: "kenya-ev-market-grows-340-2025-04-18-static1",
    source: "Business Daily Africa",
    sourceUrl: "https://businessdailyafrica.com",
    country: "ke",
    category: "kenya",
    content:
      "Kenya's electric vehicle market has grown by an extraordinary 340% over the past year, driven by a combination of government incentives, falling battery prices, and rapidly expanding charging infrastructure.\n\nImport duty exemptions introduced in the 2024 Finance Act removed a significant barrier for buyers, while new fast-charging stations along the Nairobi-Mombasa highway have eased the range anxiety that long deterred adoption.\n\nIndustry analysts point to a tipping point: as more dealers stock EVs and total cost of ownership falls below that of comparable petrol models, demand is expected to keep climbing through 2026.",
    summary:
      "Import duty exemptions and new charging infrastructure along the Nairobi-Mombasa highway are accelerating electric vehicle adoption across Kenya.",
    image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80",
    url: "#",
    urlHash: "static1",
    titleHash: "static1",
    publishedAt: "2025-04-18T11:00:00Z",
    tags: ["Kenya", "EV", "electric vehicles"],
    status: "published",
    featured: true,
    viewCount: 0,
    impactScore: null,
    kenyaSummary: null,
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
    content:
      "From Nairobi's central business district to the rugged tracks of the Maasai Mara, the Toyota Land Cruiser 300 Series remains the default choice for buyers who value reliability above all else.\n\nIts twin-turbo V6 delivers the durability East African conditions demand, while a vast parts-and-service network means owners are rarely far from support.\n\nResale values stay remarkably strong, making the LC300 as much an asset as a vehicle for fleet operators and private owners alike.",
    summary:
      "From Nairobi's CBD to the Maasai Mara, the LC300 continues to be the go-to choice for reliability and off-road capability in East Africa.",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
    url: "#",
    urlHash: "static2",
    titleHash: "static2",
    publishedAt: "2025-04-22T07:00:00Z",
    tags: ["Toyota", "Land Cruiser", "SUV", "East Africa"],
    status: "published",
    featured: false,
    viewCount: 0,
    impactScore: null,
    kenyaSummary: null,
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
    content:
      "Mazda's refined CX-5 hybrid now offers fuel economy of 5.8L/100km, making it one of the most cost-efficient imports available to Kenyan buyers.\n\nThe combination of a frugal hybrid drivetrain and Mazda's well-regarded build quality positions the CX-5 as a sensible alternative to thirstier SUVs in its class.\n\nWith import-ready units increasingly available through Kenyan dealers, it has quickly become a popular pick for families weighing running costs against everyday practicality.",
    summary:
      "Mazda's refined CX-5 hybrid now offers fuel economy of 5.8L/100km, making it one of the most cost-efficient imports for Kenyan roads.",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    url: "#",
    urlHash: "static3",
    titleHash: "static3",
    publishedAt: "2025-04-12T08:30:00Z",
    tags: ["Mazda", "Hybrid", "Kenya", "Import"],
    status: "published",
    featured: false,
    viewCount: 0,
    impactScore: null,
    kenyaSummary: null,
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
    content:
      "BMW's latest EV flagship combines M division performance with zero-emission driving, sprinting from 0-100 km/h in just 3.8 seconds.\n\nThe i5 M60 pairs a 601 HP dual-motor setup with the refinement expected of the 5 Series, delivering supercar pace without the fuel bills.\n\nFor the performance-minded buyer eyeing an electric future, it is proof that going electric need not mean giving up the driving thrills BMW is known for.",
    summary:
      "BMW's latest EV flagship combines M division performance with zero-emission driving — 0-100 km/h in 3.8 seconds.",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    url: "#",
    urlHash: "static4",
    titleHash: "static4",
    publishedAt: "2025-04-25T10:30:00Z",
    tags: ["BMW", "EV", "Electric", "Performance"],
    status: "published",
    featured: false,
    viewCount: 0,
    impactScore: null,
    kenyaSummary: null,
    createdAt: "2025-04-25T10:30:00Z",
  },
];

export function getStaticNewsBySlug(slug: string): NewsArticle | null {
  return STATIC_NEWS.find((a) => a.slug === slug) ?? null;
}

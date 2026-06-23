import type { Brand, Article } from "@/types";

// Logo resolution: see Brand type in @/types. Each brand carries either a
// logoUrl (self-hosted SVG in /public/brand-logos/, used for marks Simple
// Icons doesn't carry) or a logoSlug (Simple Icons CDN). Lettered fallback
// only kicks in if both are missing or fail to load.
export const brands: Brand[] = [
  { name: "Toyota",        slug: "toyota",        count: 4823, topModel: "Harrier",   logoSlug: "toyota" },
  { name: "Mazda",         slug: "mazda",         count: 2147, topModel: "CX-5",      logoSlug: "mazda" },
  { name: "Mercedes-Benz", slug: "mercedes-benz", count: 1568, topModel: "C-Class",   logoUrl: "/brand-logos/mercedes-benz.svg" },
  { name: "Volkswagen",    slug: "volkswagen",    count: 1342, topModel: "Tiguan",    logoSlug: "volkswagen" },
  { name: "Nissan",        slug: "nissan",        count: 2891, topModel: "X-Trail",   logoSlug: "nissan" },
  { name: "Honda",         slug: "honda",         count: 1654, topModel: "CR-V",      logoSlug: "honda" },
  { name: "BMW",           slug: "bmw",           count: 1102, topModel: "X5",        logoSlug: "bmw" },
  { name: "Ford",          slug: "ford",          count:  856, topModel: "Ranger",    logoSlug: "ford" },
  { name: "Subaru",        slug: "subaru",        count: 1923, topModel: "Forester",  logoSlug: "subaru" },
  { name: "Mitsubishi",    slug: "mitsubishi",    count: 1487, topModel: "Outlander", logoSlug: "mitsubishi" },
  { name: "Isuzu",         slug: "isuzu",         count:  943, topModel: "D-Max",     logoUrl: "/brand-logos/isuzu.svg" },
  { name: "Land Rover",    slug: "land-rover",    count:  421, topModel: "Defender",  logoUrl: "/brand-logos/land-rover.svg" },
];

export const articles: Article[] = [
  {
    slug: "byd-atto-3-six-month-review",
    title: "BYD Atto 3 Six-Month Review: What Kenya Learned About China's Best EV",
    category: "Review",
    excerpt: "After 18,000 kilometres on Kenyan roads, here's what owners are saying about range, build quality, and the charging reality.",
    body: "Six months in, the Atto 3 has surprised even the sceptics. Owners report consistent real-world range of 380–400km on a full charge, with charging at home overnight averaging KSh 850 for a complete top-up. The build quality holds up against expectations of a Chinese marque...",
    cover: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1400&q=80",
    author: "James Mwangi",
    publishedAt: "2026-04-22T08:00:00Z",
    readTime: 8,
  },
  {
    slug: "crsp-2026-what-changed",
    title: "The New CRSP Values: What Actually Changed for Kenyan Importers",
    category: "News",
    excerpt: "KRA's updated CRSP schedule landed last week. Here's a clean breakdown of the brackets, the winners, and the ones that just got more expensive.",
    body: "The 2026 CRSP review is the most consequential in five years. Most notably, hybrid vehicles under 2.0L see a meaningful drop in assessed value, while large-displacement petrol engines climb across nearly every category...",
    cover: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1400&q=80",
    author: "Wanjiru Kamau",
    publishedAt: "2026-04-19T10:30:00Z",
    readTime: 6,
  },
  {
    slug: "best-ride-share-cars-2026",
    title: "Best Cars for Bolt and Uber Drivers in Kenya (2026)",
    category: "Buying Guide",
    excerpt: "We crunched the numbers on fuel cost, maintenance, resale, and ride comfort to find the cars that actually pay back.",
    body: "If you're driving for Bolt or Uber full time, the math is unforgiving. Every shilling on fuel and maintenance comes straight off your take-home. We tracked 30 active drivers across Nairobi for three months...",
    cover: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1400&q=80",
    author: "David Otieno",
    publishedAt: "2026-04-15T14:00:00Z",
    readTime: 10,
  },
  {
    slug: "best-evs-kenya-2026",
    title: "The Best Electric Cars You Can Actually Buy in Kenya (2026)",
    category: "Buying Guide",
    excerpt: "Forget the press releases — these are the EVs you can drive home this week, with charging, support, and parts that actually exist.",
    body: "Kenya's EV scene moved from novelty to genuine choice over the past 18 months. As of April 2026, six electric models are sold and supported by official dealers, with a further four available through grey imports...",
    cover: "https://images.unsplash.com/photo-1593941707874-ef25b8b4a92b?auto=format&fit=crop&w=1400&q=80",
    author: "Faith Njeri",
    publishedAt: "2026-04-10T09:00:00Z",
    readTime: 12,
  },
  {
    slug: "fuel-prices-april-2026",
    title: "April 2026 Fuel Shock: Petrol and Diesel Jump Above KSh 200",
    category: "News",
    excerpt: "EPRA's mid-April review raised pump prices sharply. Here's what landed on the forecourt and what it costs commuters.",
    body: "EPRA's April review delivered the steepest pump price increase since November 2024. Petrol crossed the symbolic KSh 200 mark in Nairobi, with diesel close behind at KSh 198.50...",
    cover: "https://images.unsplash.com/photo-1545262810-77515befe053?auto=format&fit=crop&w=1400&q=80",
    author: "James Mwangi",
    publishedAt: "2026-04-15T07:00:00Z",
    readTime: 5,
  },
  {
    slug: "2026-toyota-harrier-review",
    title: "2026 Toyota Harrier Review: Still the Nairobi Favourite?",
    category: "Review",
    excerpt: "We spent a week with the latest Harrier across Nairobi traffic and a Naivasha weekend. Here's the verdict.",
    body: "The Harrier's grip on the Kenyan upper-middle SUV market is the kind of thing that confounds rational analysis. There are objectively newer designs, more efficient powertrains, sharper interiors. And yet...",
    cover: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1400&q=80",
    author: "Wanjiru Kamau",
    publishedAt: "2026-04-08T11:00:00Z",
    readTime: 9,
  },
];

export const trendingArticles = [
  "2026 Toyota Harrier Review: Still the Nairobi Favourite?",
  "The Hybrids Kenya Is Actually Buying in 2026",
  "NTSA's Instant-Fine Cameras: Where They Are and How to Appeal",
  "Best Cars Under KSh 2M in Kenya Right Now",
  "Best Executive Sedans for Kenyan Roads",
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

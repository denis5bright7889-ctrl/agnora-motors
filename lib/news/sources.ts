export interface RssFeedDef {
  url: string;
  source: string;
  country: string;
  category: string;
}

// ── NewsAPI queries per scope ────────────────────────────────────────────────
export const NEWSAPI_QUERIES: Record<string, string[]> = {
  kenya: [
    "NTSA Kenya automotive OR vehicle regulations",
    "Kenya car import duty KRA customs vehicle",
    "Kenya fuel price OR electric vehicle EV adoption",
    "Kenya transport policy OR road infrastructure",
    "Nairobi automotive dealer OR car market Kenya",
  ],
  "east-africa": [
    "Uganda Tanzania Rwanda automotive vehicle import",
    "East Africa transport logistics vehicle trade",
    "Ethiopia Mozambique car industry automotive",
  ],
  africa: [
    "Africa electric vehicle EV adoption infrastructure",
    "Africa automotive manufacturing industry news",
    "Nigeria South Africa Egypt car market",
    "Sub-Saharan Africa transport policy financing",
  ],
  global: [
    "Tesla new model OR recall OR earnings automotive",
    "Toyota BMW Mercedes car launch OR review",
    "electric vehicle battery range charging breakthrough",
    "autonomous self-driving vehicle news",
    "global automotive industry recall manufacturing",
  ],
};

// ── GNews queries per scope ──────────────────────────────────────────────────
export const GNEWS_QUERIES: Record<string, string[]> = {
  kenya: [
    "Kenya car news 2025",
    "NTSA Kenya vehicle",
    "Kenya electric vehicle",
  ],
  "east-africa": [
    "East Africa automotive",
    "Uganda Rwanda Tanzania car import",
  ],
  africa: [
    "Africa electric vehicle news",
    "Africa automotive industry",
  ],
  global: [
    "electric vehicle news today",
    "Toyota BMW Tesla new car",
  ],
};

// ── RSS feeds ────────────────────────────────────────────────────────────────
export const RSS_FEEDS: RssFeedDef[] = [
  // EV-focused
  { url: "https://electrek.co/feed/",                              source: "Electrek",      country: "us",  category: "ev" },
  // Global automotive
  { url: "https://www.caranddriver.com/rss/all.xml/",              source: "Car and Driver", country: "us", category: "global" },
  { url: "https://www.autocar.co.uk/rss",                          source: "Autocar",        country: "gb", category: "global" },
  // Business (automotive sections)
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml",         source: "BBC Business",   country: "gb", category: "global" },
  // Clean Energy / EV
  { url: "https://cleantechnica.com/feed/",                        source: "CleanTechnica",  country: "us", category: "ev" },
  // African business
  { url: "https://businessdailyafrica.com/rss",                    source: "Business Daily Africa", country: "ke", category: "kenya" },
];

// ── Category country map ─────────────────────────────────────────────────────
export const SCOPE_COUNTRY: Record<string, string> = {
  kenya:         "ke",
  "east-africa": "ea",
  africa:        "af",
  global:        "global",
};

// ── Keywords for auto-categorization ────────────────────────────────────────
export const KENYA_SIGNALS = ["kenya", "nairobi", "ntsa", "kra", "mombasa", "kenyan", "matatu"];
export const EV_SIGNALS    = ["electric vehicle", "ev ", "tesla", "battery", "charging", "zero-emission", "bev", "phev"];
export const SUV_SIGNALS   = ["suv", "crossover", "4x4", "prado", "land cruiser", "defender", "patrol"];

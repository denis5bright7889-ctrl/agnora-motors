import { NextResponse } from "next/server";

export const runtime = "edge";

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  source: string;
  url: string;
  image: string;
  category: string;
  publishedAt: string;
}

const NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "2025 Mercedes-Benz GLE 450 Review: The Benchmark SUV Gets Smarter",
    excerpt: "Mercedes updates the GLE with a new MBUX infotainment system and mild-hybrid powertrain, solidifying its place at the top of the luxury SUV segment.",
    source: "AutoWeek",
    url: "#",
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
    category: "Luxury",
    publishedAt: "2025-04-28T08:00:00Z",
  },
  {
    id: "n2",
    title: "BMW i5 M60 Breaks Cover: 601 HP Electric Performance Saloon",
    excerpt: "BMW's latest EV flagship combines M division performance with zero-emission driving — 0-100 km/h in 3.8 seconds.",
    source: "Car Magazine",
    url: "#",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    category: "Electric",
    publishedAt: "2025-04-25T10:30:00Z",
  },
  {
    id: "n3",
    title: "Toyota Land Cruiser 300 Series: Why It Still Dominates East Africa",
    excerpt: "From Nairobi's CBD to the Maasai Mara, the LC300 continues to be the go-to choice for reliability and off-road capability in East Africa.",
    source: "Kenyan Motor",
    url: "#",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
    category: "SUV",
    publishedAt: "2025-04-22T07:00:00Z",
  },
  {
    id: "n4",
    title: "Rolls-Royce Spectre: The First All-Electric Ultra-Luxury Car Arrives",
    excerpt: "The Spectre marks the beginning of Rolls-Royce's full electrification journey, delivering a silent, imperious drive unlike anything else on the market.",
    source: "Autocar",
    url: "#",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
    category: "Luxury",
    publishedAt: "2025-04-20T09:15:00Z",
  },
  {
    id: "n5",
    title: "Kenya's EV Market Grows 340% — What's Driving the Surge?",
    excerpt: "Import duty exemptions and new charging infrastructure along Nairobi-Mombasa highway are accelerating electric vehicle adoption across Kenya.",
    source: "Business Daily Africa",
    url: "#",
    image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80",
    category: "Electric",
    publishedAt: "2025-04-18T11:00:00Z",
  },
  {
    id: "n6",
    title: "1967 Ferrari 275 GTB/4 Sells for KSh 1.2 Billion at Auction",
    excerpt: "A pristine example of Enzo's masterpiece surpasses its estimate at a Nairobi collector car auction, drawing bidders from across the continent.",
    source: "Vintage Motors",
    url: "#",
    image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80",
    category: "Vintage",
    publishedAt: "2025-04-15T14:00:00Z",
  },
  {
    id: "n7",
    title: "2025 Mazda CX-5 Hybrid: The Import That Makes Sense for Kenya",
    excerpt: "Mazda's refined CX-5 hybrid now offers fuel economy of 5.8L/100km, making it one of the most cost-efficient imports for Kenyan roads.",
    source: "Kenyan Motor",
    url: "#",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    category: "Hybrid",
    publishedAt: "2025-04-12T08:30:00Z",
  },
  {
    id: "n8",
    title: "Porsche Cayenne Turbo GT: 640 HP Track Machine for the Road",
    excerpt: "Porsche pushes the Cayenne to its absolute limit with the Turbo GT — a supercar-fast SUV that laps the Nürburgring in under 8 minutes.",
    source: "Top Gear",
    url: "#",
    image: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=800&q=80",
    category: "Luxury",
    publishedAt: "2025-04-10T07:45:00Z",
  },
];

export async function GET() {
  return NextResponse.json({ news: NEWS });
}

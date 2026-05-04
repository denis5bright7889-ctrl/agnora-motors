export type NewsScope = "kenya" | "east-africa" | "africa" | "global";

export type NewsStatus = "published" | "pending" | "rejected";
export type ResearchCategory = "review" | "buying-guide" | "comparison" | "maintenance" | "financing";
export type ResearchStatus = "draft" | "published";

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  content?: string;
  description?: string;
  image?: string;
  publishedAt: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  source: string;
  sourceUrl: string;
  country: string;
  category: string;
  content: string | null;
  summary: string | null;
  image: string | null;
  url: string;
  urlHash: string;
  titleHash: string;
  publishedAt: string;
  tags: string[];
  status: NewsStatus;
  featured: boolean;
  viewCount: number;
  createdAt: string;
}

export interface ResearchArticle {
  id: string;
  title: string;
  slug: string;
  category: ResearchCategory;
  content: string;
  excerpt: string | null;
  author: string;
  seoTitle: string | null;
  seoDescription: string | null;
  featuredImage: string | null;
  tags: string[];
  status: ResearchStatus;
  featured: boolean;
  viewCount: number;
  sponsored: boolean;
  sponsorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineResult {
  scope: NewsScope;
  inserted: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

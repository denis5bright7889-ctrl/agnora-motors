import type { Pagination } from "./respond";

// Parse ?page=&limit= with sane bounds. Mobile + web share these defaults.
export function parsePaging(reqUrl: string, defaultLimit = 20, maxLimit = 100) {
  const sp = new URL(reqUrl).searchParams;
  const page = Math.max(1, Math.floor(Number(sp.get("page")) || 1));
  const rawLimit = Math.floor(Number(sp.get("limit")) || defaultLimit);
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

// Slice an already-fetched array into a page + build the pagination meta.
// (List lib functions return full arrays today; this keeps the response shape
// correct now and stays a one-line swap to DB-side LIMIT/OFFSET later.)
export function pageSlice<T>(all: T[], page: number, limit: number): { items: T[]; pagination: Pagination } {
  const total = all.length;
  const start = (page - 1) * limit;
  return {
    items: all.slice(start, start + limit),
    pagination: { page, limit, total, hasNext: start + limit < total },
  };
}

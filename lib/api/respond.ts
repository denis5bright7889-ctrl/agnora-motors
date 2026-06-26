import { NextResponse } from "next/server";

// Standard response envelope for Platform API v1. Every client (web, Android,
// iOS, partners) reads the same shape:
//   success: { success: true, data, meta? }
//   failure: { success: false, error: { code, message } }
//   list:    { success: true, data: [...], pagination: {...} }

export type ApiErrorCode =
  | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND"
  | "BAD_REQUEST" | "SERVER_ERROR" | "UNAVAILABLE";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  BAD_REQUEST: 400, SERVER_ERROR: 500, UNAVAILABLE: 503,
};

export interface Pagination {
  page: number; limit: number; total: number; hasNext: boolean;
}

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json(meta ? { success: true, data, meta } : { success: true, data });
}

export function paginated<T>(data: T[], pagination: Pagination): NextResponse {
  return NextResponse.json({ success: true, data, pagination });
}

export function fail(code: ApiErrorCode, message: string): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status: STATUS[code] });
}

import type { Request } from "express";

export interface ListParams {
  page: number;
  pageSize: number;
  q?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  /** Toàn bộ query string (để filter riêng của resource đọc). */
  raw: Record<string, string>;
}

export const MAX_PAGE_SIZE = 200;

/** Chuẩn hóa query danh sách theo contract: page, pageSize (≤ 200), q, sortBy, sortOrder + filter phẳng. */
export function parseListParams(req: Request, overrides: { pageSize?: number } = {}): ListParams {
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (typeof value === "string" && value !== "") raw[k] = value;
  }
  const page = Math.max(1, Math.trunc(Number(raw["page"])) || 1);
  const pageSize = overrides.pageSize ?? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(raw["pageSize"])) || 20));
  const sortOrder = raw["sortOrder"] === "asc" || raw["sortOrder"] === "desc" ? raw["sortOrder"] : undefined;
  const q = raw["q"]?.trim();
  return { page, pageSize, ...(q ? { q } : {}), ...(raw["sortBy"] ? { sortBy: raw["sortBy"] } : {}), ...(sortOrder ? { sortOrder } : {}), raw };
}

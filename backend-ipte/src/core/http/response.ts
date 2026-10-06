import type { Response } from "express";

export interface Meta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const buildMeta = (page: number, pageSize: number, total: number): Meta => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

/** Envelope thành công theo contract: { success, data, message, meta? }. */
export function ok<T>(res: Response, data: T, init: { message?: string; meta?: Meta; status?: number } = {}): Response {
  return res.status(init.status ?? 200).json({ success: true, data, message: init.message ?? "Success", ...(init.meta ? { meta: init.meta } : {}) });
}

export const created = <T>(res: Response, data: T, message = "Created") => ok(res, data, { status: 201, message });

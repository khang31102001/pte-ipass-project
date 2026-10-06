/** Chuẩn hóa kiểu dữ liệu theo contract: thời điểm ISO 8601, ngày yyyy-MM-dd, null → undefined. */
export const iso = (d: Date): string => d.toISOString();
export const isoOrNull = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const day = (d: Date | null | undefined): string | undefined => (d ? d.toISOString().slice(0, 10) : undefined);

/** yyyy-MM-dd → Date (UTC, nửa đêm) để lưu cột DATE. */
export const parseDay = (s: string | undefined | null): Date | null => (s ? new Date(`${s}T00:00:00.000Z`) : null);

/** Bỏ các khóa có giá trị null/undefined để JSON gọn và khớp interface optional của FE. */
export function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[k] = v;
  return out as T;
}

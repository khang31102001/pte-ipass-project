import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

const IDENT = /^[a-z_][a-z0-9_]*$/;
const MAX_MATCHES = 5000;

/**
 * Tìm không phân biệt hoa/thường và dấu tiếng Việt (hàm SQL vn_fold). Trả về danh sách id khớp.
 * `table`/`columns` là tên cột SQL (snake_case) do code khai báo — không bao giờ lấy từ input người dùng.
 */
export async function searchIds(table: string, columns: readonly string[], q: string): Promise<string[]> {
  if (!IDENT.test(table) || columns.some((c) => !IDENT.test(c))) throw new Error("Tên bảng/cột tìm kiếm không hợp lệ");
  const concat = Prisma.raw(columns.map((c) => `coalesce("${c}"::text, '')`).join(" || ' ' || "));
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM ${Prisma.raw(`"${table}"`)}
    WHERE vn_fold(${concat}) LIKE '%' || vn_fold(${q}) || '%'
    LIMIT ${MAX_MATCHES}`;
  return rows.map((r) => r.id);
}

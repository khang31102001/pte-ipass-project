import type { Tx } from "../db/prisma";

/** Sinh mã tuần tự nguyên tử (HV-00001…): INSERT … ON CONFLICT DO UPDATE trả về giá trị mới, an toàn khi nhiều request song song. */
export async function nextCode(tx: Tx, counter: string, prefix: string, width: number): Promise<string> {
  const row = await tx.counter.upsert({
    where: { name: counter },
    create: { name: counter, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}${String(row.value).padStart(width, "0")}`;
}

/** Slug không dấu từ tên tiếng Việt. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

import type { ZodType } from "zod";
import { badRequest } from "./errors";

/** Parse + trả lỗi 422 theo contract (errors[].field dạng a.b.0.c). */
export function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  throw badRequest(
    "Dữ liệu không hợp lệ",
    result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  );
}

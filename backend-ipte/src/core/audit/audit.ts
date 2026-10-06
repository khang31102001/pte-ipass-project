import type { Prisma } from "@prisma/client";
import type { AuthContext } from "../../auth/auth.types";
import { prisma, type Tx } from "../db/prisma";

export interface AuditEntry {
  action: "create" | "update" | "delete" | "login" | "approve" | "export";
  resource: string;
  entityId: string;
  entityLabel: string;
  before?: unknown;
  after?: unknown;
}

/** Trường không bao giờ được ghi vào nhật ký. */
const SENSITIVE = new Set(["passwordHash", "password", "secrets", "tokenHash"]);

/** JSON an toàn: Date → ISO, loại trường nhạy cảm, cắt chuỗi quá dài. */
export function snapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const clean = (v: unknown, depth: number): unknown => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "string") return v.length > 2000 ? `${v.slice(0, 2000)}…` : v;
    if (Array.isArray(v)) return depth > 4 ? [] : v.slice(0, 100).map((x) => clean(x, depth + 1));
    if (v && typeof v === "object") {
      if (depth > 4) return {};
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) if (!SENSITIVE.has(k)) out[k] = clean(x, depth + 1);
      return out;
    }
    return v;
  };
  return clean(value, 0) as Prisma.InputJsonValue;
}

/** Ghi nhật ký (dùng chung transaction với thay đổi dữ liệu để không lệch). */
export async function writeAudit(auth: Pick<AuthContext, "userId" | "name" | "roleName" | "ip"> | undefined, entry: AuditEntry, db: Tx = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: auth?.userId ?? null,
      actorName: auth?.name ?? "Hệ thống",
      actorRole: auth?.roleName ?? "system",
      action: entry.action,
      resource: entry.resource,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      before: snapshot(entry.before),
      after: snapshot(entry.after),
      ip: auth?.ip ?? null,
    },
  });
}

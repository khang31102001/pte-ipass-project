import type { ZodType } from "zod";
import { z } from "../../contract/validation";
import type { AuditLog as AuditLogDto } from "../../contract/audit-logs/types";
import type { AuditLog } from "@prisma/client";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { iso } from "../../core/crud/dto";

const toDto = (l: AuditLog): AuditLogDto => ({
  id: l.id,
  actorId: l.actorId ?? "",
  actorName: l.actorName,
  actorRole: l.actorRole,
  action: l.action,
  resource: l.resource,
  entityId: l.entityId,
  entityLabel: l.entityLabel,
  before: l.before,
  after: l.after,
  ip: l.ip ?? "",
  createdAt: iso(l.createdAt),
  updatedAt: iso(l.createdAt),
});

const dayStart = (s: string) => new Date(`${s}T00:00:00.000Z`);
const dayEnd = (s: string) => new Date(`${s}T23:59:59.999Z`);

/** Nhật ký chỉ đọc: tạo tự động bởi mọi thao tác ghi; không có API sửa/xóa. */
const service = createCrudService<AuditLog, AuditLogDto, Record<string, never>>({
  resource: "audit_log",
  label: "nhật ký",
  table: "audit_logs",
  delegate: (db) => db.auditLog,
  schema: z.object({}).strict() as ZodType<Record<string, never>>,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["actor_name", "entity_label", "entity_id"],
  filters: {
    action: (v) => ({ action: v }),
    resource: (v) => ({ resource: v }),
    actorId: (v) => ({ actorId: v }),
    from: (v) => ({ createdAt: { gte: dayStart(v) } }),
    to: (v) => ({ createdAt: { lte: dayEnd(v) } }),
  },
  sortable: { createdAt: (d) => ({ createdAt: d }), actorName: (d) => ({ actorName: d }), action: (d) => ({ action: d }), resource: (d) => ({ resource: d }) },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (l) => l.entityLabel,
  toCreateData: () => ({}),
  toUpdateData: () => ({}),
  exportable: true,
});

export const auditLogsRouter = crudRouter("audit_log", service, { label: "nhật ký", exportable: true, only: ["list", "get"] });

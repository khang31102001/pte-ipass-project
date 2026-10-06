import type { Prisma } from "@prisma/client";
import { ALL_PERMISSIONS } from "../../contract/permissions";
import type { Role as RoleDto } from "../../contract/roles/types";
import { roleSchema, type RoleInput } from "../../contract/roles/schemas";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { iso } from "../../core/crud/dto";
import { conflict } from "../../core/http/errors";

const include = { permissions: { include: { permission: true } }, _count: { select: { users: true } } } satisfies Prisma.RoleInclude;
type RoleRow = Prisma.RoleGetPayload<{ include: typeof include }>;

const toDto = (r: RoleRow): RoleDto => ({
  id: r.id,
  name: r.name,
  ...(r.description ? { description: r.description } : {}),
  permissions: r.permissions.map((p) => p.permission.code).sort(),
  isSystem: r.isSystem,
  userCount: r._count.users,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

const permissionLinks = (codes: string[]) => codes.map((code) => ({ permission: { connect: { code } } }));

export const roleService = createCrudService<RoleRow, RoleDto, RoleInput>({
  resource: "role",
  label: "vai trò",
  table: "roles",
  delegate: (db) => db.role,
  include,
  schema: roleSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["name", "description"],
  sortable: { name: (d) => ({ name: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "name", sortOrder: "asc" },
  entityLabel: (r) => r.name,
  uniqueFields: { name: { field: "name", message: "Tên vai trò đã tồn tại" } },
  // Chống tự khóa hệ thống: vai trò Admin luôn giữ đủ quyền.
  guard: ({ input, current }) => {
    if (current?.name === "Admin" && ALL_PERMISSIONS.some((p) => !input.permissions.includes(p))) throw conflict("Không thể giảm quyền của vai trò Admin");
  },
  toCreateData: (input) => ({
    name: input.name,
    description: input.description ?? null,
    isSystem: false,
    permissions: { create: permissionLinks(input.permissions) },
  }),
  toUpdateData: (input, current) => ({
    // Đổi tên vai trò hệ thống không được phép (mã nguồn tham chiếu theo tên).
    name: current.isSystem ? current.name : input.name,
    description: input.description ?? null,
    permissions: { deleteMany: {}, create: permissionLinks(input.permissions) },
  }),
  beforeDelete: (r) => {
    if (r.isSystem) throw conflict("Không thể xóa vai trò hệ thống");
    if (r._count.users > 0) throw conflict("Vai trò đang được gán cho người dùng, hãy chuyển người dùng sang vai trò khác trước");
  },
});

export const rolesRouter = crudRouter("role", roleService, { label: "vai trò" });

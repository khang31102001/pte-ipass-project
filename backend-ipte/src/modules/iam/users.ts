import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { authenticate, requirePermission } from "../../auth/middleware";
import { hashPassword } from "../../auth/password";
import { userSchema, type UserInput } from "../../contract/users/schemas";
import type { User as UserDto } from "../../contract/users/types";
import { writeAudit } from "../../core/audit/audit";
import { prisma } from "../../core/db/prisma";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { iso, isoOrNull } from "../../core/crud/dto";
import { handler } from "../../core/http/async";
import { conflict, notFound } from "../../core/http/errors";
import { created, ok } from "../../core/http/response";
import { parseBody } from "../../core/http/validate";

const include = { role: true } satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof include }>;

/** Không bao giờ trả passwordHash/failedAttempts/tokenVersion ra API. */
const toDto = (u: UserRow): UserDto => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  ...(u.phone ? { phone: u.phone } : {}),
  roleId: u.roleId,
  roleName: u.role.name,
  ...(u.branchId ? { branchId: u.branchId } : {}),
  status: u.status,
  avatarUrl: u.avatarUrl,
  lastLoginAt: isoOrNull(u.lastLoginAt),
  createdAt: iso(u.createdAt),
  updatedAt: iso(u.updatedAt),
});

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";

/** Mật khẩu tạm 14 ký tự (có chữ hoa/thường/số), sinh bằng CSPRNG. */
export function temporaryPassword(): string {
  const all = LOWER + UPPER + DIGIT;
  const pick = (set: string) => set[randomInt(set.length)] as string;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), ...Array.from({ length: 11 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join("");
}

const ensureRole = async (roleId: string) => {
  if (!(await prisma.role.findUnique({ where: { id: roleId } }))) throw conflict("Vai trò không tồn tại", [{ field: "roleId", message: "Vai trò không tồn tại" }]);
};

const userService = createCrudService<UserRow, UserDto, UserInput>({
  resource: "user",
  label: "người dùng",
  table: "users",
  delegate: (db) => db.user,
  include,
  schema: userSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["full_name", "email", "phone"],
  filters: {
    roleId: (v) => ({ roleId: v }),
    status: (v) => ({ status: v }),
    branchId: (v) => ({ branchId: v }),
  },
  sortable: {
    fullName: (d) => ({ fullName: d }),
    email: (d) => ({ email: d }),
    createdAt: (d) => ({ createdAt: d }),
    lastLoginAt: (d) => ({ lastLoginAt: d }),
    status: (d) => ({ status: d }),
  },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (u) => `${u.fullName} <${u.email}>`,
  uniqueFields: { email: { field: "email", message: "Email đã được sử dụng" } },
  exportable: true,
  guard: async ({ input }) => ensureRole(input.roleId),
  // Mật khẩu tạm được cấp ở route POST (không lưu trong DTO); ở đây chỉ đặt cờ bắt đổi mật khẩu.
  toCreateData: async (input) => ({
    email: input.email.toLowerCase(),
    fullName: input.fullName,
    phone: input.phone ?? null,
    roleId: input.roleId,
    branchId: input.branchId ?? null,
    status: input.status,
    passwordHash: await hashPassword(temporaryPassword()),
    mustChangePassword: true,
  }),
  toUpdateData: (input, current) => ({
    email: input.email.toLowerCase(),
    fullName: input.fullName,
    phone: input.phone ?? null,
    roleId: input.roleId,
    branchId: input.branchId ?? null,
    status: input.status,
    // Đổi vai trò/trạng thái ⇒ thu hồi mọi token đang dùng để quyền mới có hiệu lực ngay.
    ...(input.roleId !== current.roleId || input.status !== current.status ? { tokenVersion: { increment: 1 } } : {}),
  }),
  beforeDelete: async (u, { auth }) => {
    if (auth?.userId === u.id) throw conflict("Không thể tự xóa tài khoản đang đăng nhập");
    const admins = await prisma.user.count({ where: { role: { name: "Admin" }, status: "active", id: { not: u.id } } });
    if (u.role.name === "Admin" && admins === 0) throw conflict("Không thể xóa quản trị viên cuối cùng");
  },
});

export const usersRouter = Router();
const base = crudRouter("user", userService, { label: "người dùng", exportable: true, only: ["list", "get", "update", "delete"] });

// Tạo user: cấp mật khẩu tạm và trả về MỘT LẦN cho người quản trị chuyển cho nhân sự.
usersRouter.post(
  "/",
  authenticate,
  requirePermission("user.create"),
  handler(async (req, res) => {
    const input = parseBody(userSchema, req.body);
    await ensureRole(input.roleId);
    const temp = temporaryPassword();
    let user: UserRow;
    try {
      user = await prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          fullName: input.fullName,
          phone: input.phone ?? null,
          roleId: input.roleId,
          branchId: input.branchId ?? null,
          status: input.status,
          passwordHash: await hashPassword(temp),
          mustChangePassword: true,
        },
        include,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw conflict("Email đã được sử dụng", [{ field: "email", message: "Email đã được sử dụng" }]);
      throw error;
    }
    await writeAudit(req.auth, { action: "create", resource: "user", entityId: user.id, entityLabel: `${user.fullName} <${user.email}>`, after: user });
    return created(res, { ...toDto(user), temporaryPassword: temp });
  }),
);

/** Cấp lại mật khẩu tạm + thu hồi mọi phiên của người dùng. */
usersRouter.post(
  "/:id/reset-password",
  authenticate,
  requirePermission("user.edit"),
  handler(async (req, res) => {
    const id = String(req.params["id"]);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw notFound("Không tìm thấy người dùng");
    const temp = temporaryPassword();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true, tokenVersion: { increment: 1 }, failedAttempts: 0, lockedUntil: null } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeAudit(req.auth, { action: "update", resource: "user", entityId: id, entityLabel: `${target.email} (cấp lại mật khẩu)` }, tx);
    });
    return ok(res, { temporaryPassword: temp }, { message: "Đã cấp mật khẩu tạm" });
  }),
);

usersRouter.use(base);

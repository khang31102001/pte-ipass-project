import type { NextFunction, Request, Response } from "express";
import { prisma } from "../core/db/prisma";
import { forbidden, unauthorized } from "../core/http/errors";
import type { AuthContext } from "./auth.types";
import type { Permission } from "../contract/permissions";
import { verifyAccessToken } from "./tokens";

export const clientIp = (req: Request): string | undefined => req.ip ?? req.socket.remoteAddress ?? undefined;

async function loadContext(token: string, ip: string | undefined): Promise<AuthContext | null> {
  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user || user.status !== "active" || user.tokenVersion !== claims.tv) return null;
  return {
    userId: user.id,
    name: user.fullName,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    branchId: user.branchId,
    permissions: new Set(user.role.permissions.map((rp) => rp.permission.code)),
    ip,
  };
}

const bearer = (req: Request) => (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);

/** Bắt buộc đăng nhập: gắn `req.auth` (user + role + quyền đọc từ DB mỗi request, không tin claim trong token). */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearer(req);
    if (!token) throw unauthorized();
    const ctx = await loadContext(token, clientIp(req));
    if (!ctx) throw unauthorized();
    req.auth = ctx;
    next();
  } catch (error) {
    next(error);
  }
}

/** Kiểm tra quyền `resource.action` độc lập với FE (FE chỉ ẩn nút). Dùng sau `authenticate`. */
export const requirePermission =
  (permission: Permission) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!req.auth.permissions.has(permission)) return next(forbidden());
    next();
  };

/** Có quyền hay không (dùng trong service, ví dụ approve để xuất bản). */
export const can = (auth: AuthContext | undefined, permission: Permission): boolean => Boolean(auth?.permissions.has(permission));

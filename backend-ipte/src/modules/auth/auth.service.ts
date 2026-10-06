import { z } from "zod";
import { env } from "../../config/env";
import type { AuthContext } from "../../auth/auth.types";
import { dummyVerify, hashPassword, passwordIssues, verifyPassword } from "../../auth/password";
import { accessTtlSeconds, hashToken, newFamilyId, newRefreshToken, signAccessToken } from "../../auth/tokens";
import { writeAudit } from "../../core/audit/audit";
import { prisma } from "../../core/db/prisma";
import { badRequest, tooMany, unauthorized } from "../../core/http/errors";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"), newPassword: z.string().min(1, "Nhập mật khẩu mới") });

export interface SessionPayload {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  role: { id: string; name: string };
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  session: SessionPayload;
}

interface ClientInfo {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

const userWithRole = { include: { role: { include: { permissions: { include: { permission: true } } } } } } as const;

export async function toSession(userId: string): Promise<SessionPayload> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, ...userWithRole });
  return {
    user: { id: u.id, name: u.fullName, email: u.email, avatarUrl: u.avatarUrl },
    role: { id: u.role.id, name: u.role.name },
    permissions: u.role.permissions.map((p) => p.permission.code).sort(),
  };
}

async function issueRefresh(userId: string, familyId: string, client: ClientInfo) {
  const token = newRefreshToken();
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000),
      ip: client.ip ?? null,
      userAgent: client.userAgent ?? null,
    },
  });
  return { token, id: row.id };
}

export async function login(input: z.infer<typeof loginSchema>, client: ClientInfo): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email }, ...userWithRole });
  // Thông báo chung cho mọi lý do thất bại: không lộ email có tồn tại hay không.
  const fail = () => unauthorized("Email hoặc mật khẩu không đúng");

  if (!user) {
    await dummyVerify(input.password);
    throw fail();
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) throw tooMany("Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.");

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const failed = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedAttempts: failed },
    });
    throw fail();
  }
  if (user.status !== "active") throw unauthorized("Tài khoản đã bị khóa hoặc ngưng hoạt động");

  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const refreshRow = await issueRefresh(user.id, newFamilyId(), client);
  await writeAudit({ userId: user.id, name: user.fullName, roleName: user.role.name, ...(client.ip ? { ip: client.ip } : {}) }, { action: "login", resource: "user", entityId: user.id, entityLabel: user.email });

  return {
    accessToken: signAccessToken({ sub: user.id, tv: user.tokenVersion }),
    expiresIn: accessTtlSeconds(),
    refreshToken: refreshRow.token,
    session: await toSession(user.id),
  };
}

/** Xoay vòng refresh token. Dùng lại token đã xoay (dấu hiệu bị đánh cắp) ⇒ thu hồi cả family. */
export async function refresh(token: string | undefined, client: ClientInfo): Promise<LoginResult> {
  if (!token) throw unauthorized();
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!row) throw unauthorized();

  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw unauthorized("Phiên không hợp lệ");
  }
  if (row.expiresAt < new Date() || row.user.status !== "active") throw unauthorized();

  const next = await issueRefresh(row.userId, row.familyId, client);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedBy: next.id } });
  return {
    accessToken: signAccessToken({ sub: row.userId, tv: row.user.tokenVersion }),
    expiresIn: accessTtlSeconds(),
    refreshToken: next.token,
    session: await toSession(row.userId),
  };
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (row) await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function changePassword(auth: AuthContext, input: z.infer<typeof changePasswordSchema>): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw badRequest("Mật khẩu hiện tại không đúng", [{ field: "currentPassword", message: "Mật khẩu hiện tại không đúng" }]);
  }
  const issue = passwordIssues(input.newPassword);
  if (issue) throw badRequest(issue, [{ field: "newPassword", message: issue }]);

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (tx) => {
    // Tăng tokenVersion ⇒ mọi access token cũ mất hiệu lực; thu hồi mọi refresh token.
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
    await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(auth, { action: "update", resource: "user", entityId: user.id, entityLabel: `${user.email} (đổi mật khẩu)` }, tx);
  });
}

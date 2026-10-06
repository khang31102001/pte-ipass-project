import request from "supertest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth/password";
import { prisma } from "../src/core/db/prisma";

export const app = createApp();
export const api = () => request(app);
export const PASSWORD = "Test-Password-123";

let seq = 0;
export const uniq = (p = "x") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Tạo user với một vai trò hệ thống (hoặc vai trò tùy chỉnh) rồi đăng nhập thật qua API. */
export async function loginAs(roleName: string, extra: { email?: string; password?: string } = {}) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const email = extra.email ?? `${uniq(roleName.toLowerCase())}@test.local`;
  const password = extra.password ?? PASSWORD;
  const user = await prisma.user.create({ data: { email, fullName: `Test ${roleName}`, roleId: role.id, passwordHash: await hashPassword(password), status: "active" } });
  const res = await api().post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`login failed ${res.status}`);
  const cookie = (res.headers["set-cookie"] as unknown as string[] | undefined)?.[0] ?? "";
  return { user, email, password, token: res.body.data.accessToken as string, cookie, auth: { Authorization: `Bearer ${res.body.data.accessToken as string}` } };
}

export const adminAuth = async () => (await loginAs("Admin")).auth;

import { describe, expect, it } from "vitest";
import { prisma } from "../src/core/db/prisma";
import { PASSWORD, api, loginAs, uniq } from "./helpers";

describe("Authentication", () => {
  it("đăng nhập đúng trả access token + phiên, đặt cookie refresh httpOnly", async () => {
    const { email } = await loginAs("Sales");
    const res = await api().post("/api/auth/login").send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Success" });
    expect(res.body.data.accessToken).toBeTypeOf("string");
    expect(res.body.data.role.name).toBe("Sales");
    expect(res.body.data.permissions).toContain("student.view");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    const cookie = String((res.headers["set-cookie"] as unknown as string[])[0]);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/ipte_refresh=/);
  });

  it("sai thông tin: 401 và thông báo giống nhau cho email không tồn tại / sai mật khẩu (không lộ tài khoản)", async () => {
    const { email } = await loginAs("Sales");
    const wrongPass = await api().post("/api/auth/login").send({ email, password: "sai-mat-khau" });
    const unknown = await api().post("/api/auth/login").send({ email: `${uniq("no")}@test.local`, password: "sai-mat-khau" });
    expect(wrongPass.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPass.body.message).toBe(unknown.body.message);
    expect(wrongPass.body.code).toBe("UNAUTHORIZED");
  });

  it("khóa tạm sau 5 lần sai liên tiếp", async () => {
    const { email } = await loginAs("Sales");
    for (let i = 0; i < 5; i++) await api().post("/api/auth/login").send({ email, password: "sai" });
    const locked = await api().post("/api/auth/login").send({ email, password: PASSWORD });
    expect(locked.status).toBe(429);
  });

  it("validate đầu vào đăng nhập: 422 có errors theo field", async () => {
    const res = await api().post("/api/auth/login").send({ email: "khong-phai-email", password: "" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("GET /auth/me cần token; token sai/hết hạn ⇒ 401", async () => {
    expect((await api().get("/api/auth/me")).status).toBe(401);
    expect((await api().get("/api/auth/me").set("Authorization", "Bearer abc.def.ghi")).status).toBe(401);
    const { auth } = await loginAs("Teacher");
    const me = await api().get("/api/auth/me").set(auth);
    expect(me.status).toBe(200);
    expect(me.body.data.role.name).toBe("Teacher");
  });

  it("refresh xoay vòng token; dùng lại token cũ ⇒ thu hồi cả phiên", async () => {
    const { cookie } = await loginAs("Sales");
    const first = await api().post("/api/auth/refresh").set("Cookie", cookie);
    expect(first.status).toBe(200);
    const newCookie = String((first.headers["set-cookie"] as unknown as string[])[0]);
    // dùng lại cookie cũ (đã bị xoay) ⇒ bị từ chối và phiên mới cũng bị thu hồi
    const reuse = await api().post("/api/auth/refresh").set("Cookie", cookie);
    expect(reuse.status).toBe(401);
    const afterRevoke = await api().post("/api/auth/refresh").set("Cookie", newCookie);
    expect(afterRevoke.status).toBe(401);
  });

  it("logout thu hồi refresh token", async () => {
    const { cookie } = await loginAs("Sales");
    expect((await api().post("/api/auth/logout").set("Cookie", cookie)).status).toBe(200);
    expect((await api().post("/api/auth/refresh").set("Cookie", cookie)).status).toBe(401);
  });

  it("đổi mật khẩu: kiểm tra chính sách, vô hiệu hóa access token cũ", async () => {
    const { auth, email } = await loginAs("Sales");
    const weak = await api().post("/api/auth/change-password").set(auth).send({ currentPassword: PASSWORD, newPassword: "yeu" });
    expect(weak.status).toBe(422);
    const wrong = await api().post("/api/auth/change-password").set(auth).send({ currentPassword: "khong-dung", newPassword: "Mat-Khau-Moi-123" });
    expect(wrong.status).toBe(422);
    const ok = await api().post("/api/auth/change-password").set(auth).send({ currentPassword: PASSWORD, newPassword: "Mat-Khau-Moi-123" });
    expect(ok.status).toBe(200);
    expect((await api().get("/api/auth/me").set(auth)).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email, password: "Mat-Khau-Moi-123" })).status).toBe(200);
  });

  it("tài khoản bị khóa/ngưng hoạt động không dùng được token đang có", async () => {
    const { auth, user } = await loginAs("Sales");
    await prisma.user.update({ where: { id: user.id }, data: { status: "locked" } });
    expect((await api().get("/api/auth/me").set(auth)).status).toBe(401);
  });

  it("mật khẩu được băm argon2id, không lưu plaintext", async () => {
    const { user } = await loginAs("Sales");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(row.passwordHash).not.toContain(PASSWORD);
  });
});

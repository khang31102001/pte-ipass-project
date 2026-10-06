import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/core/db/prisma";
import { adminAuth, api, loginAs, uniq } from "./helpers";

let admin: Record<string, string>;
let courseCategoryId: string;
let articleCategoryId: string;

beforeAll(async () => {
  admin = await adminAuth();
  courseCategoryId = (await prisma.courseCategory.findFirstOrThrow()).id;
  articleCategoryId = (await prisma.articleCategory.findFirstOrThrow()).id;
});

const student = (over: Record<string, unknown> = {}) => ({ fullName: "Nguyễn Thị Đào", gender: "female", email: `${uniq("hv")}@test.local`, phone: "0912345678", source: "website", status: "active", tags: [], ...over });
const branch = (over: Record<string, unknown> = {}) => ({ code: uniq("CS").slice(0, 18), name: "Cơ sở thử", country: "VN", city: "HCM", address: "1 Nguyễn Huệ", phone: "0281234567", status: "active", ...over });
const teacher = (over: Record<string, unknown> = {}) => ({ fullName: `Giáo viên ${uniq()}`, email: `${uniq("gv")}@test.local`, yearsExperience: 3, specialties: ["speaking"], qualifications: [], status: "active", availability: [], ...over });
const course = (over: Record<string, unknown> = {}) => ({ code: uniq("KH").slice(0, 20), name: `Khóa ${uniq()}`, slug: uniq("khoa-"), categoryId: courseCategoryId, type: "target_score", targetScore: 50, entryLevel: "36", mode: "online", durationWeeks: 8, sessionsCount: 24, tuition: 9_000_000, teacherIds: [], summary: "Mô tả ngắn", outcomes: [], audience: [], status: "draft", isFeatured: false, ...over });

describe("Phân quyền (RBAC) ở backend", () => {
  it("chưa đăng nhập ⇒ 401 ở mọi module quản trị", async () => {
    for (const p of ["/api/students", "/api/courses", "/api/users", "/api/roles", "/api/audit-logs", "/api/dashboard/summary", "/api/settings/global"]) {
      expect((await api().get(p)).status, p).toBe(401);
    }
  });

  it("Sales xem/tạo học viên nhưng KHÔNG xóa được; không xem được users/roles", async () => {
    const sales = (await loginAs("Sales")).auth;
    const created = await api().post("/api/students").set(sales).send(student());
    expect(created.status).toBe(201);
    expect((await api().delete(`/api/students/${created.body.data.id}`).set(sales)).status).toBe(403);
    expect((await api().get("/api/users").set(sales)).status).toBe(403);
    expect((await api().get("/api/roles").set(sales)).status).toBe(403);
    expect((await api().post("/api/courses").set(sales).send(course())).status).toBe(403);
  });

  it("xuất dữ liệu cần quyền export riêng (Teacher có view nhưng không export)", async () => {
    const t = (await loginAs("Teacher")).auth;
    expect((await api().get("/api/students").set(t)).status).toBe(200);
    expect((await api().get("/api/students/export").set(t)).status).toBe(403);
    expect((await api().get("/api/students/export").set(admin)).status).toBe(200);
  });

  it("chỉ người có quyền Duyệt mới xuất bản (published)", async () => {
    const role = await prisma.role.create({ data: { name: uniq("NoApprove"), permissions: { create: [{ permission: { connect: { code: "course.view" } } }, { permission: { connect: { code: "course.create" } } }, { permission: { connect: { code: "course.edit" } } }] } } });
    const u = await loginAs(role.name);
    const draft = await api().post("/api/courses").set(u.auth).send(course());
    expect(draft.status).toBe(201);
    const pub = await api().post("/api/courses").set(u.auth).send(course({ status: "published" }));
    expect(pub.status).toBe(403);
    const upd = await api().put(`/api/courses/${draft.body.data.id}`).set(u.auth).send(course({ status: "published" }));
    expect(upd.status).toBe(403);
    expect((await api().post("/api/courses").set(admin).send(course({ status: "published" }))).status).toBe(201);
  });

  it("đổi quyền vai trò có hiệu lực ngay (quyền đọc từ DB mỗi request)", async () => {
    const role = await prisma.role.create({ data: { name: uniq("Dyn"), permissions: { create: [{ permission: { connect: { code: "banner.view" } } }] } } });
    const u = await loginAs(role.name);
    expect((await api().get("/api/banners").set(u.auth)).status).toBe(200);
    expect((await api().post("/api/banners").set(u.auth).send({})).status).toBe(403);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    expect((await api().get("/api/banners").set(u.auth)).status).toBe(403);
  });
});

describe("Hợp đồng API", () => {
  it("lỗi validate 422 theo field; id sai định dạng ⇒ 404; route lạ ⇒ 404 envelope", async () => {
    const bad = await api().post("/api/students").set(admin).send({ fullName: "", email: "x", phone: "1" });
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ success: false, data: null, code: "VALIDATION_ERROR" });
    expect(bad.body.errors.map((e: { field: string }) => e.field)).toEqual(expect.arrayContaining(["fullName", "email", "phone"]));
    expect((await api().get("/api/students/khong-phai-uuid").set(admin)).status).toBe(404);
    const missing = await api().get("/api/students/00000000-0000-4000-8000-000000000000").set(admin);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("NOT_FOUND");
    expect((await api().get("/api/khong-ton-tai").set(admin)).body).toMatchObject({ success: false, code: "NOT_FOUND" });
  });

  it("FK không tồn tại ⇒ 422 theo field (không phải 500)", async () => {
    const res = await api().post("/api/courses").set(admin).send(course({ categoryId: "00000000-0000-4000-8000-000000000000" }));
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe("categoryId");
  });

  it("danh sách: phân trang, tìm không dấu tiếng Việt, lọc, sắp xếp", async () => {
    const tag = uniq("zz");
    for (const n of ["Trần Đức Anh", "Lê Văn Bình", "Phạm Thị Cúc"]) {
      expect((await api().post("/api/students").set(admin).send(student({ fullName: `${n} ${tag}`, source: n.startsWith("Lê") ? "facebook" : "website" }))).status).toBe(201);
    }
    const all = await api().get("/api/students").query({ q: tag, pageSize: 2, sortBy: "fullName", sortOrder: "asc" }).set(admin);
    expect(all.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(all.body.data.map((s: { fullName: string }) => s.fullName)[0]).toContain("Lê Văn Bình");
    const accent = await api().get("/api/students").query({ q: `tran duc anh ${tag}` }).set(admin);
    expect(accent.body.data).toHaveLength(1);
    const filtered = await api().get("/api/students").query({ q: tag, source: "facebook" }).set(admin);
    expect(filtered.body.data).toHaveLength(1);
    const page2 = await api().get("/api/students").query({ q: tag, pageSize: 2, page: 2 }).set(admin);
    expect(page2.body.data).toHaveLength(1);
    expect((await api().get("/api/students").query({ pageSize: 9999 }).set(admin)).body.meta.pageSize).toBe(200);
  });

  it("sortBy ngoài danh sách cho phép bị bỏ qua (không lỗi, không SQL injection)", async () => {
    const res = await api().get("/api/students").query({ sortBy: "id; DROP TABLE students;--" }).set(admin);
    expect(res.status).toBe(200);
    expect(await prisma.student.count()).toBeGreaterThan(0);
  });
});

describe("Học viên, hồ sơ, hành trình", () => {
  it("tạo học viên: sinh mã HV-, trạng thái lead, sự kiện hành trình đầu tiên; email trùng ⇒ 422", async () => {
    const body = student();
    const res = await api().post("/api/students").set(admin).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^HV-\d{5}$/);
    expect(res.body.data.stage).toBe("lead");
    const journey = await api().get(`/api/students/${res.body.data.id}/journey`).set(admin);
    expect(journey.body.data.events).toHaveLength(1);
    const dup = await api().post("/api/students").set(admin).send(student({ email: body.email }));
    expect(dup.status).toBe(422);
    expect(dup.body.errors[0].field).toBe("email");
  });

  it("mã học viên duy nhất khi tạo song song", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => api().post("/api/students").set(admin).send(student())));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.data.code)).size).toBe(8);
  });

  it("hồ sơ PTE: chưa có ⇒ null; PUT tạo/cập nhật; tóm tắt hiện trong danh sách", async () => {
    const s = (await api().post("/api/students").set(admin).send(student())).body.data;
    expect((await api().get(`/api/students/${s.id}/profile`).set(admin)).body.data).toBeNull();
    const profile = { currentLevel: "42", targetScore: 65, purpose: "migration", examDeadline: "2027-03-01", preferredMode: "online" };
    const put = await api().put(`/api/students/${s.id}/profile`).set(admin).send(profile);
    expect(put.status).toBe(200);
    const detail = await api().get(`/api/students/${s.id}`).set(admin);
    expect(detail.body.data).toMatchObject({ targetScore: 65, examDeadline: "2027-03-01" });
    expect((await api().put(`/api/students/${s.id}/profile`).set(admin).send({ ...profile, targetScore: 95 })).status).toBe(422);
  });

  it("hành trình chỉ chuyển tiến; thi cần ngày thi; kết quả cần điểm và đóng hồ sơ", async () => {
    const s = (await api().post("/api/students").set(admin).send(student())).body.data;
    const adv = (b: object) => api().post(`/api/students/${s.id}/journey/advance`).set(admin).send(b);
    expect((await adv({ stage: "test", score: 40 })).status).toBe(201);
    expect((await adv({ stage: "lead" })).status).toBe(409);
    expect((await adv({ stage: "test" })).status).toBe(409);
    expect((await adv({ stage: "exam" })).status).toBe(422);
    expect((await adv({ stage: "exam", examDate: "2027-01-10" })).status).toBe(201);
    expect((await adv({ stage: "result" })).status).toBe(422);
    expect((await adv({ stage: "result", score: 66, passed: true })).status).toBe(201);
    const after = await api().get(`/api/students/${s.id}`).set(admin);
    expect(after.body.data).toMatchObject({ stage: "result", status: "closed" });
    const note = await api().post(`/api/students/${s.id}/journey/notes`).set(admin).send({ note: "Gọi lại tuần sau" });
    expect(note.status).toBe(201);
  });

  it("chuyển giai đoạn đồng thời: chỉ một request thành công (khóa hàng)", async () => {
    const s = (await api().post("/api/students").set(admin).send(student())).body.data;
    const results = await Promise.all(Array.from({ length: 4 }, () => api().post(`/api/students/${s.id}/journey/advance`).set(admin).send({ stage: "test", score: 30 })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
  });

  it("xóa học viên xóa luôn hồ sơ, hành trình, lộ trình (cascade) và ghi audit", async () => {
    const s = (await api().post("/api/students").set(admin).send(student())).body.data;
    await api().put(`/api/students/${s.id}/profile`).set(admin).send({ currentLevel: "none", targetScore: 50, purpose: "work", preferredMode: "online" });
    expect((await api().delete(`/api/students/${s.id}`).set(admin)).status).toBe(200);
    expect(await prisma.studentProfile.count({ where: { studentId: s.id } })).toBe(0);
    expect(await prisma.journeyEvent.count({ where: { studentId: s.id } })).toBe(0);
    const logs = await api().get("/api/audit-logs").query({ resource: "student", action: "delete" }).set(admin);
    expect(logs.body.data.some((l: { entityId: string }) => l.entityId === s.id)).toBe(true);
  });
});

describe("Ràng buộc nghiệp vụ", () => {
  it("cơ sở còn phòng ⇒ 409; xóa phòng rồi mới xóa được cơ sở", async () => {
    const b = (await api().post("/api/branches").set(admin).send(branch())).body.data;
    const room = (await api().post("/api/rooms").set(admin).send({ branchId: b.id, name: "A1", capacity: 20, type: "classroom", status: "available", equipment: [] })).body.data;
    expect((await api().delete(`/api/branches/${b.id}`).set(admin)).status).toBe(409);
    expect((await api().delete(`/api/rooms/${room.id}`).set(admin)).status).toBe(200);
    expect((await api().delete(`/api/branches/${b.id}`).set(admin)).status).toBe(200);
  });

  it("mã cơ sở trùng ⇒ 422 theo field; tên phòng trùng trong cùng cơ sở ⇒ 422", async () => {
    const body = branch();
    const b = (await api().post("/api/branches").set(admin).send(body)).body.data;
    expect((await api().post("/api/branches").set(admin).send(body)).body.errors[0].field).toBe("code");
    const room = { branchId: b.id, name: "B1", capacity: 10, type: "lab", status: "available", equipment: [] };
    expect((await api().post("/api/rooms").set(admin).send(room)).status).toBe(201);
    expect((await api().post("/api/rooms").set(admin).send(room)).status).toBe(422);
  });

  it("giáo viên đang phụ trách khóa học ⇒ 409; sinh mã GV- và slug duy nhất", async () => {
    const t = (await api().post("/api/teachers").set(admin).send(teacher({ fullName: "Đỗ Thị Hương" }))).body.data;
    expect(t.code).toMatch(/^GV-\d{3,}$/);
    const t2 = (await api().post("/api/teachers").set(admin).send(teacher({ fullName: "Đỗ Thị Hương" }))).body.data;
    expect(t2.code).not.toBe(t.code);
    const c = (await api().post("/api/courses").set(admin).send(course({ teacherIds: [t.id] }))).body.data;
    expect(c.teacherNames).toContain("Đỗ Thị Hương");
    const del = await api().delete(`/api/teachers/${t.id}`).set(admin);
    expect(del.status).toBe(409);
    expect(del.body.message).toContain("Giáo viên đang phụ trách");
    expect((await api().get(`/api/teachers/${t.id}`).set(admin)).body.data.courses).toHaveLength(1);
  });

  it("danh mục khóa học còn khóa học ⇒ 409; khóa học trùng mã/slug ⇒ 422", async () => {
    const cat = (await api().post("/api/course-categories").set(admin).send({ name: `Danh mục ${uniq()}`, slug: uniq("dm-"), sortOrder: 1, isActive: true })).body.data;
    const body = course({ categoryId: cat.id });
    expect((await api().post("/api/courses").set(admin).send(body)).status).toBe(201);
    const dup = await api().post("/api/courses").set(admin).send(body);
    expect(dup.status).toBe(422);
    expect(dup.body.errors[0].field).toMatch(/^(code|slug)$/);
    expect((await api().delete(`/api/course-categories/${cat.id}`).set(admin)).status).toBe(409);
  });

  it("bài học còn học liệu ⇒ 409; khóa học bị xóa kéo theo bài học", async () => {
    const c = (await api().post("/api/courses").set(admin).send(course())).body.data;
    const l = (await api().post("/api/lessons").set(admin).send({ courseId: c.id, title: "Bài 1", order: 1, type: "video", durationMinutes: 30, status: "draft" })).body.data;
    expect(l.order).toBe(1);
    await api().post("/api/learning-materials").set(admin).send({ title: "Slide", type: "pdf", url: "https://x.test/a.pdf", lessonId: l.id, courseId: c.id, tags: [], visibility: "enrolled", status: "draft" });
    expect((await api().delete(`/api/lessons/${l.id}`).set(admin)).status).toBe(409);
    expect((await api().get("/api/lessons").query({ courseId: c.id }).set(admin)).body.data[0].materialCount).toBe(1);
    expect((await api().delete(`/api/courses/${c.id}`).set(admin)).status).toBe(200);
    expect(await prisma.lesson.count({ where: { courseId: c.id } })).toBe(0);
  });

  it("vai trò: hệ thống không xóa được; Admin không bị giảm quyền; đang gán người dùng ⇒ 409", async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Admin" } });
    expect((await api().delete(`/api/roles/${adminRole.id}`).set(admin)).status).toBe(409);
    const reduce = await api().put(`/api/roles/${adminRole.id}`).set(admin).send({ name: "Admin", permissions: ["student.view"] });
    expect(reduce.status).toBe(409);
    const custom = (await api().post("/api/roles").set(admin).send({ name: `Vai trò ${uniq()}`, permissions: ["student.view"] })).body.data;
    expect(custom.isSystem).toBe(false);
    expect((await api().post("/api/roles").set(admin).send({ name: custom.name, permissions: [] })).status).toBe(422);
    expect((await api().post("/api/roles").set(admin).send({ name: "X", permissions: ["khong.ton.tai"] })).status).toBe(422);
    const u = await api().post("/api/users").set(admin).send({ fullName: "Người dùng", email: `${uniq("u")}@test.local`, roleId: custom.id, status: "active" });
    expect(u.status).toBe(201);
    expect((await api().delete(`/api/roles/${custom.id}`).set(admin)).status).toBe(409);
  });

  it("tạo user trả mật khẩu tạm MỘT lần, không lộ băm; reset-password thu hồi phiên", async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: "Sales" } });
    const email = `${uniq("nv")}@test.local`;
    const created = await api().post("/api/users").set(admin).send({ fullName: "Nhân viên mới", email, roleId: role.id, status: "active" });
    expect(created.status).toBe(201);
    const temp = created.body.data.temporaryPassword as string;
    expect(temp).toHaveLength(14);
    expect(JSON.stringify(created.body)).not.toMatch(/passwordHash|argon2/);
    const login = await api().post("/api/auth/login").send({ email, password: temp });
    expect(login.status).toBe(200);
    const reset = await api().post(`/api/users/${created.body.data.id}/reset-password`).set(admin);
    expect(reset.status).toBe(200);
    expect((await api().get("/api/auth/me").set({ Authorization: `Bearer ${login.body.data.accessToken}` })).status).toBe(401);
    expect((await api().get(`/api/users/${created.body.data.id}`).set(admin)).body.data).not.toHaveProperty("passwordHash");
  });

  it("không xóa được tài khoản đang đăng nhập / quản trị viên cuối cùng", async () => {
    const me = await loginAs("Admin");
    expect((await api().delete(`/api/users/${me.user.id}`).set(me.auth)).status).toBe(409);
  });
});

describe("Lộ trình học", () => {
  it("gợi ý lộ trình dựa trên khóa đang mở, cảnh báo trễ hạn; tạo/lưu và tính tiến độ", async () => {
    const mk = (n: number) => api().post("/api/courses").set(admin).send(course({ code: uniq(`T${n}-`).slice(0, 20), slug: uniq(`t${n}-`), name: `Luyện PTE ${n}`, targetScore: n, status: "published", durationWeeks: 10 }));
    await mk(58);
    await mk(65);
    const gen = await api().post("/api/learning-paths/generate").set(admin).send({ currentLevel: "50", targetScore: 65, deadline: "2026-11-01", startDate: "2026-10-06", weeklyHours: 5 });
    expect(gen.status).toBe(200);
    expect(gen.body.data.steps.length).toBeGreaterThan(0);
    expect(gen.body.data.feasible).toBe(false);
    expect(gen.body.data.warnings.join(" ")).toContain("trễ hạn");

    const s = (await api().post("/api/students").set(admin).send(student())).body.data;
    const path = await api().post("/api/learning-paths").set(admin).send({ studentId: s.id, title: "Lộ trình thử", currentLevel: "50", targetScore: 65, startDate: "2026-10-06", weeklyHours: 8, status: "active", steps: gen.body.data.steps.map((st: object, i: number) => ({ ...st, status: i === 0 ? "done" : "pending" })) });
    expect(path.status).toBe(201);
    expect(path.body.data.progress).toBe(Math.round((1 / gen.body.data.steps.length) * 100));
    expect(path.body.data.studentCode).toBe(s.code);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/core/db/prisma";
import { adminAuth, api, loginAs, uniq } from "./helpers";

let admin: Record<string, string>;
let courseCategoryId: string;
let articleCategoryId: string;

beforeAll(async () => {
  admin = await adminAuth();
  courseCategoryId = (await prisma.courseCategory.findFirstOrThrow()).id;
  articleCategoryId = (await prisma.articleCategory.findFirstOrThrow({ where: { slug: "kien-thuc-pte" } })).id;
});

const article = (over: Record<string, unknown> = {}) => ({ title: `Bài ${uniq()}`, slug: uniq("bai-"), excerpt: "Tóm tắt", content: "<p>Nội dung bài viết ".repeat(30) + "</p>", categoryId: articleCategoryId, tagIds: [], isFeatured: false, status: "draft", ...over });

describe("CMS", () => {
  it("bài viết: tính thời gian đọc, đặt publishedAt lần đầu xuất bản và giữ nguyên các lần sau", async () => {
    const created = await api().post("/api/articles").set(admin).send(article({ status: "published" }));
    expect(created.status).toBe(201);
    expect(created.body.data.readingMinutes).toBeGreaterThanOrEqual(1);
    expect(created.body.data.publishedAt).toBeTypeOf("string");
    const first = created.body.data.publishedAt;
    const upd = await api().put(`/api/articles/${created.body.data.id}`).set(admin).send(article({ title: "Sửa", slug: created.body.data.slug, status: "published" }));
    expect(upd.body.data.publishedAt).toBe(first);
    expect(upd.body.data.authorName).toBeTypeOf("string");
  });

  it("bài viết: slug trùng ⇒ 422; tag được gắn/gỡ; danh mục còn bài ⇒ 409", async () => {
    const tag = (await api().post("/api/tags").set(admin).send({ name: `Tag ${uniq()}`, slug: uniq("tag-") })).body.data;
    const a = article({ tagIds: [tag.id] });
    const created = await api().post("/api/articles").set(admin).send(a);
    expect(created.body.data.tagNames).toEqual([tag.name]);
    expect((await api().post("/api/articles").set(admin).send(a)).status).toBe(422);
    const noTag = await api().put(`/api/articles/${created.body.data.id}`).set(admin).send({ ...a, tagIds: [] });
    expect(noTag.body.data.tagIds).toEqual([]);
    expect((await api().delete(`/api/article-categories/${articleCategoryId}`).set(admin)).status).toBe(409);
  });

  it("trang landing cần ít nhất 1 khối; trang tĩnh cần nội dung; chỉ Marketing (approve) xuất bản", async () => {
    const base = { title: `Trang ${uniq()}`, slug: uniq("trang-"), status: "draft", noindex: false };
    expect((await api().post("/api/pages").set(admin).send({ ...base, template: "landing", sections: [] })).status).toBe(422);
    expect((await api().post("/api/pages").set(admin).send({ ...base, template: "static" })).status).toBe(422);
    expect((await api().post("/api/pages").set(admin).send({ ...base, template: "static", content: "<p>Nội dung</p>" })).status).toBe(201);
    const role = await prisma.role.create({ data: { name: uniq("PageEditor"), permissions: { create: ["page.view", "page.create", "page.edit"].map((code) => ({ permission: { connect: { code } } })) } } });
    const editor = await loginAs(role.name);
    const res = await api().post("/api/pages").set(editor.auth).send({ ...base, slug: uniq("trang-"), template: "static", content: "x", status: "published" });
    expect(res.status).toBe(403);
  });

  it("biểu mẫu đã có dữ liệu gửi không xóa được; admin chỉ xử lý lead (không sửa dữ liệu gốc)", async () => {
    const slug = uniq("form-");
    const form = (await api().post("/api/forms").set(admin).send({ name: "Form thử", slug, type: "contact", fields: [{ key: "fullName", label: "Họ tên", type: "text", required: true, options: [] }, { key: "phone", label: "SĐT", type: "phone", required: true, options: [] }], submitLabel: "Gửi", successMessage: "Cảm ơn", notifyEmails: [], status: "active" })).body.data;
    const sub = await api().post(`/api/public/forms/${slug}/submit`).send({ data: { fullName: "Khách", phone: "0912345678" }, source: { utmSource: "facebook", landingPage: "/khoa-hoc" } });
    expect(sub.status).toBe(201);
    expect((await api().delete(`/api/forms/${form.id}`).set(admin)).status).toBe(409);
    const list = await api().get("/api/form-submissions").query({ formId: form.id }).set(admin);
    const id = list.body.data[0].id;
    expect(list.body.data[0]).toMatchObject({ status: "new", source: { utmSource: "facebook" } });
    const assignee = (await loginAs("Sales")).user;
    const upd = await api().put(`/api/form-submissions/${id}`).set(admin).send({ status: "contacted", assignedTo: assignee.id, notes: "Đã gọi" });
    expect(upd.body.data).toMatchObject({ status: "contacted", assignedToName: assignee.fullName, data: { fullName: "Khách" } });
  });
});

describe("API công khai", () => {
  it("không cần đăng nhập, chỉ trả nội dung đã xuất bản và không lộ trường nội bộ", async () => {
    const draftCourse = (await api().post("/api/courses").set(admin).send({ code: uniq("D").slice(0, 20), name: "Khóa nháp", slug: uniq("nhap-"), categoryId: courseCategoryId, type: "core", entryLevel: "none", mode: "online", durationWeeks: 4, sessionsCount: 8, tuition: 0, teacherIds: [], summary: "x", outcomes: [], audience: [], status: "draft", isFeatured: false })).body.data;
    const pubCourse = (await api().post("/api/courses").set(admin).send({ code: uniq("P").slice(0, 20), name: "Khóa công khai", slug: uniq("cong-khai-"), categoryId: courseCategoryId, type: "core", entryLevel: "none", mode: "online", durationWeeks: 4, sessionsCount: 8, tuition: 0, teacherIds: [], summary: "x", outcomes: [], audience: [], status: "published", isFeatured: true })).body.data;
    const list = await api().get("/api/public/courses").query({ pageSize: 100 });
    expect(list.status).toBe(200);
    const slugs = list.body.data.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain(pubCourse.slug);
    expect(slugs).not.toContain(draftCourse.slug);
    for (const c of list.body.data) for (const k of ["code", "status", "teacherIds", "enrolledCount"]) expect(c).not.toHaveProperty(k);
    expect((await api().get(`/api/public/courses/${draftCourse.slug}`)).status).toBe(404);
    expect((await api().get(`/api/public/courses/${pubCourse.slug}`)).status).toBe(200);
    expect((await api().get("/api/public/courses").query({ isFeatured: "true", pageSize: 100 })).body.data.every((c: { isFeatured: boolean }) => c.isFeatured)).toBe(true);
  });

  it("bài viết công khai: lọc nhiều danh mục, chi tiết kèm bài liên quan, bài nháp 404", async () => {
    const pub = (await api().post("/api/articles").set(admin).send(article({ status: "published" }))).body.data;
    await api().post("/api/articles").set(admin).send(article({ status: "published" }));
    const draft = (await api().post("/api/articles").set(admin).send(article({ status: "draft" }))).body.data;
    const cat = (await api().get("/api/public/article-categories")).body.data.find((c: { slug: string }) => c.slug === "kien-thuc-pte");
    expect(cat.articleCount).toBeGreaterThanOrEqual(2);
    const list = await api().get("/api/public/articles").query({ categorySlugs: "kien-thuc-pte,kinh-nghiem-thi", pageSize: 100 });
    expect(list.body.data.every((a: { categorySlug: string }) => ["kien-thuc-pte", "kinh-nghiem-thi"].includes(a.categorySlug))).toBe(true);
    expect(list.body.data.map((a: { slug: string }) => a.slug)).not.toContain(draft.slug);
    const detail = await api().get(`/api/public/articles/${pub.slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.related.length).toBeGreaterThan(0);
    expect((await api().get(`/api/public/articles/${draft.slug}`)).status).toBe(404);
  });

  it("giáo viên công khai: không lộ email/điện thoại; chỉ đang giảng dạy", async () => {
    const t = (await api().post("/api/teachers").set(admin).send({ fullName: `GV ${uniq()}`, email: `${uniq("t")}@test.local`, phone: "0912345678", yearsExperience: 2, specialties: [], qualifications: [], status: "active", availability: [] })).body.data;
    const off = (await api().post("/api/teachers").set(admin).send({ fullName: `GV nghỉ ${uniq()}`, email: `${uniq("t")}@test.local`, yearsExperience: 2, specialties: [], qualifications: [], status: "inactive", availability: [] })).body.data;
    const list = (await api().get("/api/public/teachers").query({ pageSize: 100 })).body.data;
    expect(list.map((x: { id: string }) => x.id)).toContain(t.id);
    expect(list.map((x: { id: string }) => x.id)).not.toContain(off.id);
    for (const x of list) for (const k of ["email", "phone", "availability", "code"]) expect(x).not.toHaveProperty(k);
    expect((await api().get(`/api/public/teachers/${list.find((x: { id: string }) => x.id === t.id).slug}`)).status).toBe(200);
  });

  it("banner: chỉ active trong khoảng ngày; trang: chỉ published; biểu mẫu ẩn email thông báo", async () => {
    const mk = (over: object) => api().post("/api/banners").set(admin).send({ title: `B ${uniq()}`, placement: "popup", imageUrl: "/images/a.png", sortOrder: 1, status: "active", ...over });
    const live = (await mk({})).body.data;
    const expired = (await mk({ endAt: "2020-01-01" })).body.data;
    const inactive = (await mk({ status: "inactive" })).body.data;
    const ids = (await api().get("/api/public/banners").query({ placement: "popup" })).body.data.map((b: { id: string }) => b.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(expired.id);
    expect(ids).not.toContain(inactive.id);
    expect((await api().get("/api/public/pages/trang-chu")).status).toBe(200);
    const slug = uniq("kin-");
    await api().post("/api/forms").set(admin).send({ name: "Kín", slug, type: "other", fields: [{ key: "fullName", label: "Tên", type: "text", required: true, options: [] }], submitLabel: "Gửi", successMessage: "ok", notifyEmails: ["noi-bo@test.local"], status: "active" });
    const f = await api().get(`/api/public/forms/${slug}`);
    expect(f.status).toBe(200);
    expect(JSON.stringify(f.body)).not.toContain("noi-bo@test.local");
  });

  it("gửi lead: validate theo định nghĩa trường (required/email/phone/select), bỏ khóa lạ, lưu nguồn", async () => {
    const slug = uniq("lead-");
    await api().post("/api/forms").set(admin).send({
      name: "Lead",
      slug,
      type: "consultation",
      fields: [
        { key: "fullName", label: "Họ tên", type: "text", required: true, options: [] },
        { key: "phone", label: "SĐT", type: "phone", required: true, options: [] },
        { key: "email", label: "Email", type: "email", required: false, options: [] },
        { key: "score", label: "Điểm", type: "select", required: false, options: ["PTE 50", "PTE 65"] },
        { key: "agree", label: "Đồng ý", type: "checkbox", required: true, options: [] },
      ],
      submitLabel: "Gửi",
      successMessage: "Cảm ơn",
      notifyEmails: [],
      status: "active",
    });
    const bad = await api().post(`/api/public/forms/${slug}/submit`).send({ data: { phone: "abc", email: "x", score: "PTE 99" } });
    expect(bad.status).toBe(422);
    expect(bad.body.errors.map((e: { field: string }) => e.field)).toEqual(expect.arrayContaining(["data.fullName", "data.phone", "data.email", "data.score", "data.agree"]));
    const ok = await api().post(`/api/public/forms/${slug}/submit`).send({ data: { fullName: "A B", phone: "0912345678", agree: "true", hack: "<script>" }, source: { utmSource: "google" } });
    expect(ok.status).toBe(201);
    const saved = await prisma.formSubmission.findFirstOrThrow({ where: { id: ok.body.data.id } });
    expect(saved.data).toEqual({ fullName: "A B", phone: "0912345678", agree: "true" });
    expect(saved.status).toBe("new");
    expect((await api().post(`/api/public/forms/${uniq("khong-co")}/submit`).send({ data: {} })).status).toBe(404);
  });
});

describe("Cấu hình, bảo mật bí mật, báo cáo, audit", () => {
  it("bí mật tích hợp chỉ ghi: không bao giờ trả về, lưu mã hóa trong DB", async () => {
    const body = { smtp: { enabled: true, host: "smtp.test.local", port: 587, fromEmail: "no-reply@test.local", password: "smtp-bi-mat-123", secure: false }, recaptcha: { enabled: true, siteKey: "site-key", secret: "recaptcha-bi-mat-456" }, crm: { enabled: false }, storage: { provider: "local" } };
    const put = await api().put("/api/settings/integration").set(admin).send(body);
    expect(put.status).toBe(200);
    expect(put.body.data.smtp.hasPassword).toBe(true);
    expect(put.body.data.recaptcha.hasSecret).toBe(true);
    const get = await api().get("/api/settings/integration").set(admin);
    expect(JSON.stringify(get.body)).not.toMatch(/smtp-bi-mat|recaptcha-bi-mat|password"|secret"/);
    const row = await prisma.setting.findUniqueOrThrow({ where: { group: "integration" } });
    expect(JSON.stringify(row.secrets)).not.toContain("smtp-bi-mat-123");
    // để trống = giữ nguyên bí mật đang lưu
    const keep = await api().put("/api/settings/integration").set(admin).send({ ...body, smtp: { ...body.smtp, password: "" } });
    expect(keep.body.data.smtp.hasPassword).toBe(true);
    const audit = await api().get("/api/audit-logs").query({ resource: "setting" }).set(admin);
    expect(JSON.stringify(audit.body)).not.toContain("bi-mat");
    const bad = await api().put("/api/settings/integration").set(admin).send({ ...body, smtp: { ...body.smtp, host: "" } });
    expect(bad.status).toBe(422);
  });

  it("site-config: GET/PUT, validate widget chat, công khai không lộ người cập nhật", async () => {
    const current = (await api().get("/api/site-config").set(admin)).body.data;
    const bad = await api().put("/api/site-config").set(admin).send({ ...current, chat: { ...current.chat, zalo: { enabled: true } } });
    expect(bad.status).toBe(422);
    const good = await api().put("/api/site-config").set(admin).send({ ...current, tracking: { ga4Id: "G-ABCDE12345" } });
    expect(good.status).toBe(200);
    const pub = await api().get("/api/public/site-config");
    expect(pub.body.data.tracking.ga4Id).toBe("G-ABCDE12345");
    expect(pub.body.data).not.toHaveProperty("updatedByName");
  });

  it("audit log: ghi create/update/delete/export/login, trước/sau, chỉ đọc, không lộ mật khẩu", async () => {
    const t = (await api().post("/api/tags").set(admin).send({ name: `Audit ${uniq()}`, slug: uniq("au-") })).body.data;
    await api().put(`/api/tags/${t.id}`).set(admin).send({ name: `${t.name} v2`, slug: t.slug });
    await api().delete(`/api/tags/${t.id}`).set(admin);
    const logs = (await api().get("/api/audit-logs").query({ resource: "taxonomy", pageSize: 100 }).set(admin)).body.data.filter((l: { entityId: string }) => l.entityId === t.id);
    expect(logs.map((l: { action: string }) => l.action).sort()).toEqual(["create", "delete", "update"]);
    const update = logs.find((l: { action: string }) => l.action === "update");
    expect(update.before.name).not.toBe(update.after.name);
    expect((await api().get("/api/audit-logs").query({ action: "login" }).set(admin)).body.data.length).toBeGreaterThan(0);
    expect((await api().post("/api/audit-logs").set(admin).send({})).status).toBe(404);
    expect((await api().delete(`/api/audit-logs/${logs[0].id}`).set(admin)).status).toBe(404);
    expect(JSON.stringify(logs)).not.toMatch(/passwordHash|argon2/);
  });

  it("dashboard và báo cáo tính từ dữ liệu thật (phễu, nguồn lead, ghi danh)", async () => {
    const mk = async () => (await api().post("/api/students").set(admin).send({ fullName: "Học viên báo cáo", gender: "male", email: `${uniq("bc")}@test.local`, phone: "0912345678", source: "website", status: "active", tags: [] })).body.data;
    const a = await mk();
    const b = await mk();
    await api().post(`/api/students/${a.id}/journey/advance`).set(admin).send({ stage: "test", score: 40 });
    await api().post(`/api/students/${a.id}/journey/advance`).set(admin).send({ stage: "enroll" });
    await api().post(`/api/students/${b.id}/journey/advance`).set(admin).send({ stage: "test", score: 45 });
    await api().post(`/api/students/${a.id}/journey/advance`).set(admin).send({ stage: "result", score: 60, passed: true });

    const funnel = (await api().get("/api/reports/funnel").set(admin)).body.data;
    expect(funnel.steps.map((s: { stage: string }) => s.stage)).toEqual(["lead", "test", "enroll", "learn", "mock", "exam", "result"]);
    const counts = Object.fromEntries(funnel.steps.map((s: { stage: string; count: number }) => [s.stage, s.count]));
    expect(counts["lead"]).toBeGreaterThanOrEqual(2);
    expect(counts["test"]).toBeGreaterThanOrEqual(2);
    expect(counts["result"]).toBeGreaterThanOrEqual(1);
    expect(counts["lead"]).toBeGreaterThanOrEqual(counts["test"]);

    const enroll = (await api().get("/api/reports/enrollments").set(admin)).body.data;
    expect(enroll.total).toBeGreaterThanOrEqual(1);
    const summary = (await api().get("/api/dashboard/summary").set(admin)).body.data;
    expect(summary.kpis.examResults).toBeGreaterThanOrEqual(1);
    expect(summary.kpis.passRate).toBeGreaterThan(0);
    expect(summary.kpis.avgScoreGain).toBeGreaterThan(0);
    expect(summary.leadsByDay.length).toBeGreaterThan(1);
    const sources = (await api().get("/api/reports/lead-sources").set(admin)).body.data;
    expect(sources.total).toBeGreaterThanOrEqual(1);
    expect((await api().get("/api/reports/funnel/export").set(admin)).status).toBe(200);
    expect((await api().get("/api/reports/funnel/export").set((await loginAs("Sales")).auth)).status).toBe(403);
  });

  it("lookups cho form: cần đăng nhập, lọc q và parentId", async () => {
    expect((await api().get("/api/lookups/roles")).status).toBe(401);
    const roles = await api().get("/api/lookups/roles").set(admin);
    expect(roles.body.data[0]).toHaveProperty("value");
    expect(roles.body.data[0]).toHaveProperty("label");
    expect((await api().get("/api/lookups/khong-co").set(admin)).status).toBe(404);
    expect((await api().get("/api/lookups/staff").query({ q: "test admin" }).set(admin)).body.data.length).toBeGreaterThan(0);
  });

  it("CORS chỉ cho origin cấu hình; header bảo mật (helmet) có mặt; health", async () => {
    const ok = await api().get("/health");
    expect(ok.status).toBe(200);
    expect(ok.headers["x-powered-by"]).toBeUndefined();
    expect(ok.headers["x-content-type-options"]).toBe("nosniff");
    const allowed = await api().options("/api/auth/login").set("Origin", "http://localhost:3000").set("Access-Control-Request-Method", "POST");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const denied = await api().options("/api/auth/login").set("Origin", "http://evil.test").set("Access-Control-Request-Method", "POST");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

import type { Prisma } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { clientIp } from "../../auth/middleware";
import { env } from "../../config/env";
import { publicSubmitSchema } from "../../contract/forms/schemas";
import type { FormFieldDef } from "../../contract/forms/types";
import type {
  PublicArticle,
  PublicArticleCategory,
  PublicArticleDetail,
  PublicBanner,
  PublicBranch,
  PublicCourse,
  PublicCourseCategory,
  PublicForm,
  PublicPage,
  PublicSitemapEntry,
  PublicTeacher,
  PublicTestimonial,
} from "../../contract/public-api/types";
import { searchIds } from "../../core/crud/search";
import { buildMeta } from "../../core/http/response";
import { compact, iso, isoOrNull } from "../../core/crud/dto";
import { prisma } from "../../core/db/prisma";
import { handler } from "../../core/http/async";
import { badRequest, notFound } from "../../core/http/errors";
import { created, ok } from "../../core/http/response";
import { parseBody } from "../../core/http/validate";
import { logger } from "../../core/logger";
import { sendMail, verifyCaptcha } from "../system/integrations";
import { loadSiteConfig, toSiteConfig } from "../system/site-config";

/**
 * API công khai cho website (không cần đăng nhập). Chỉ trả nội dung ĐÃ XUẤT BẢN và loại bỏ mọi trường nội bộ
 * (mã, trạng thái duyệt, email/điện thoại giáo viên, email nhận thông báo…).
 */
export const publicRouter = Router();

/** Nội dung công khai cache được ở CDN/proxy; website còn có ISR + webhook revalidate. */
publicRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  next();
});

const page = (req: Request, max = 100) => {
  const q = req.query as Record<string, string | undefined>;
  const pageNo = Math.max(1, Math.trunc(Number(q["page"])) || 1);
  const pageSize = Math.min(max, Math.max(1, Math.trunc(Number(q["pageSize"])) || 20));
  return { pageNo, pageSize, skip: (pageNo - 1) * pageSize, q: q["q"]?.trim() || undefined, raw: q };
};

const list = <T>(res: Response, items: T[], p: { pageNo: number; pageSize: number }, total: number) =>
  res.status(200).json({ success: true, data: items, message: "Success", meta: buildMeta(p.pageNo, p.pageSize, total) });

// ── Cấu hình ───────────────────────────────────────────────────────────────
publicRouter.get(
  "/site-config",
  handler(async (_req, res) => {
    const { updatedByName: _omit, ...config } = toSiteConfig(await loadSiteConfig());
    void _omit;
    return ok(res, config);
  }),
);

// ── Khóa học ───────────────────────────────────────────────────────────────
const courseInclude = { category: true, teachers: { include: { teacher: true } } } satisfies Prisma.CourseInclude;
type CourseRow = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;

const slugOfTeacher = (t: { slug: string }) => t.slug;

const toCourse = (c: CourseRow, withDescription = false): PublicCourse =>
  compact({
    id: c.id,
    name: c.name,
    slug: c.slug,
    categoryId: c.categoryId,
    categoryName: c.category.name,
    categorySlug: c.category.slug,
    type: c.type,
    targetScore: (c.targetScore ?? undefined) as PublicCourse["targetScore"],
    entryLevel: c.entryLevel as PublicCourse["entryLevel"],
    mode: c.mode,
    durationWeeks: c.durationWeeks,
    sessionsCount: c.sessionsCount,
    tuition: c.tuition,
    summary: c.summary,
    description: withDescription ? (c.description ?? undefined) : undefined,
    outcomes: c.outcomes,
    audience: c.audience,
    isFeatured: c.isFeatured,
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    metaTitle: c.metaTitle ?? undefined,
    metaDescription: c.metaDescription ?? undefined,
    teachers: c.teachers.filter((t) => t.teacher.status === "active").map((t) => ({ id: t.teacher.id, slug: slugOfTeacher(t.teacher), name: t.teacher.fullName, avatarUrl: t.teacher.avatarUrl })),
  });

publicRouter.get(
  "/course-categories",
  handler(async (_req, res) => {
    const rows = await prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { courses: { where: { status: "published" } } } } } });
    const data: PublicCourseCategory[] = rows.map((c) => compact({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? undefined, sortOrder: c.sortOrder, courseCount: c._count.courses }));
    return ok(res, data);
  }),
);

publicRouter.get(
  "/courses",
  handler(async (req, res) => {
    const p = page(req);
    const and: Prisma.CourseWhereInput[] = [{ status: "published" }];
    if (p.raw["categorySlug"]) and.push({ category: { slug: p.raw["categorySlug"] } });
    if (p.raw["isFeatured"]) and.push({ isFeatured: p.raw["isFeatured"] === "true" });
    if (p.q) and.push({ id: { in: await searchIds("courses", ["name", "summary"], p.q) } });
    const where: Prisma.CourseWhereInput = { AND: and };
    const sortKey = p.raw["sortBy"];
    const dir = p.raw["sortOrder"] === "desc" ? "desc" : "asc";
    const orderBy: Prisma.CourseOrderByWithRelationInput[] = [
      sortKey === "tuition" ? { tuition: dir } : sortKey === "name" ? { name: dir } : sortKey === "durationWeeks" ? { durationWeeks: dir } : { targetScore: { sort: dir, nulls: "last" } },
      { id: "asc" },
    ];
    const [rows, total] = await Promise.all([prisma.course.findMany({ where, orderBy, skip: p.skip, take: p.pageSize, include: courseInclude }), prisma.course.count({ where })]);
    return list(res, rows.map((r) => toCourse(r)), p, total);
  }),
);

publicRouter.get(
  "/courses/:slug",
  handler(async (req, res) => {
    const course = await prisma.course.findFirst({ where: { slug: String(req.params["slug"]), status: "published" }, include: courseInclude });
    if (!course) throw notFound("Khóa học không tồn tại");
    return ok(res, toCourse(course, true));
  }),
);

// ── Bài viết ───────────────────────────────────────────────────────────────
const articleInclude = { category: true, author: { select: { fullName: true } }, tags: { include: { tag: true } } } satisfies Prisma.ArticleInclude;
type ArticleRow = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

const toArticle = (a: ArticleRow, full = false): PublicArticle =>
  compact({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    content: full ? a.content : "",
    coverUrl: a.coverUrl ?? undefined,
    categoryId: a.categoryId,
    categoryName: a.category.name,
    categorySlug: a.category.slug,
    tagNames: a.tags.map((t) => t.tag.name),
    authorName: a.author?.fullName,
    isFeatured: a.isFeatured,
    publishedAt: isoOrNull(a.publishedAt),
    metaTitle: a.metaTitle ?? undefined,
    metaDescription: a.metaDescription ?? undefined,
    readingMinutes: a.readingMinutes,
  });

publicRouter.get(
  "/article-categories",
  handler(async (_req, res) => {
    const rows = await prisma.articleCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { articles: { where: { status: "published" } } } } } });
    const data: PublicArticleCategory[] = rows.map((c) => compact({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? undefined, sortOrder: c.sortOrder, articleCount: c._count.articles }));
    return ok(res, data);
  }),
);

publicRouter.get(
  "/articles",
  handler(async (req, res) => {
    const p = page(req);
    const and: Prisma.ArticleWhereInput[] = [{ status: "published" }];
    if (p.raw["categorySlugs"]) and.push({ category: { slug: { in: p.raw["categorySlugs"].split(",").filter(Boolean) } } });
    if (p.raw["isFeatured"]) and.push({ isFeatured: p.raw["isFeatured"] === "true" });
    if (p.raw["excludeSlug"]) and.push({ slug: { not: p.raw["excludeSlug"] } });
    if (p.q) and.push({ id: { in: await searchIds("articles", ["title", "excerpt"], p.q) } });
    const where: Prisma.ArticleWhereInput = { AND: and };
    const dir = p.raw["sortOrder"] === "asc" ? "asc" : "desc";
    const orderBy: Prisma.ArticleOrderByWithRelationInput[] = [p.raw["sortBy"] === "title" ? { title: dir } : { publishedAt: dir }, { id: "asc" }];
    const [rows, total] = await Promise.all([prisma.article.findMany({ where, orderBy, skip: p.skip, take: p.pageSize, include: articleInclude }), prisma.article.count({ where })]);
    return list(res, rows.map((r) => toArticle(r)), p, total);
  }),
);

publicRouter.get(
  "/articles/:slug",
  handler(async (req, res) => {
    const article = await prisma.article.findFirst({ where: { slug: String(req.params["slug"]), status: "published" }, include: articleInclude });
    if (!article) throw notFound("Bài viết không tồn tại");
    const related = await prisma.article.findMany({ where: { status: "published", categoryId: article.categoryId, id: { not: article.id } }, orderBy: { publishedAt: "desc" }, take: 6, include: articleInclude });
    // Đếm lượt xem không chặn phản hồi.
    void prisma.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
    const detail: PublicArticleDetail = { ...toArticle(article, true), related: related.map((r) => toArticle(r)) };
    return ok(res, detail);
  }),
);

// ── Giáo viên, cảm nhận, banner, chi nhánh, trang ──────────────────────────
const toTeacher = (t: Prisma.TeacherGetPayload<object>): PublicTeacher =>
  compact({ id: t.id, slug: t.slug, fullName: t.fullName, headline: t.headline ?? undefined, bio: t.bio ?? undefined, pteScore: t.pteScore ?? undefined, yearsExperience: t.yearsExperience, specialties: t.specialties, qualifications: t.qualifications, avatarUrl: t.avatarUrl }) as PublicTeacher;

publicRouter.get(
  "/teachers",
  handler(async (req, res) => {
    const p = page(req);
    const and: Prisma.TeacherWhereInput[] = [{ status: "active" }];
    if (p.q) and.push({ id: { in: await searchIds("teachers", ["full_name", "headline"], p.q) } });
    const where: Prisma.TeacherWhereInput = { AND: and };
    const [rows, total] = await Promise.all([
      prisma.teacher.findMany({ where, orderBy: [{ pteScore: { sort: "desc", nulls: "last" } }, { fullName: "asc" }], skip: p.skip, take: p.pageSize }),
      prisma.teacher.count({ where }),
    ]);
    return list(res, rows.map(toTeacher), p, total);
  }),
);

publicRouter.get(
  "/teachers/:slug",
  handler(async (req, res) => {
    const t = await prisma.teacher.findFirst({ where: { slug: String(req.params["slug"]), status: "active" } });
    if (!t) throw notFound("Giáo viên không tồn tại");
    return ok(res, toTeacher(t));
  }),
);

publicRouter.get(
  "/testimonials",
  handler(async (req, res) => {
    const p = page(req);
    const where: Prisma.TestimonialWhereInput = { status: "published", ...(p.raw["isFeatured"] ? { isFeatured: p.raw["isFeatured"] === "true" } : {}) };
    const [rows, total] = await Promise.all([
      prisma.testimonial.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], skip: p.skip, take: p.pageSize, include: { course: { select: { name: true } } } }),
      prisma.testimonial.count({ where }),
    ]);
    const data: PublicTestimonial[] = rows.map((t) =>
      compact({ id: t.id, studentName: t.studentName, headline: t.headline, quote: t.quote, avatarUrl: t.avatarUrl ?? undefined, scoreBefore: t.scoreBefore ?? undefined, scoreAfter: t.scoreAfter, rating: t.rating, courseName: t.course?.name, videoUrl: t.videoUrl ?? undefined, isFeatured: t.isFeatured }),
    );
    return list(res, data, p, total);
  }),
);

publicRouter.get(
  "/banners",
  handler(async (req, res) => {
    const placement = (req.query["placement"] as string | undefined) || undefined;
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const rows = await prisma.banner.findMany({
      where: {
        status: "active",
        ...(placement ? { placement: placement as Prisma.BannerWhereInput["placement"] } : {}),
        AND: [{ OR: [{ startAt: null }, { startAt: { lte: today } }] }, { OR: [{ endAt: null }, { endAt: { gte: today } }] }],
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    const data: PublicBanner[] = rows.map((b) => compact({ id: b.id, title: b.title, placement: b.placement, imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl ?? undefined, linkUrl: b.linkUrl ?? undefined, altText: b.altText ?? undefined }));
    return ok(res, data);
  }),
);

publicRouter.get(
  "/branches",
  handler(async (_req, res) => {
    const rows = await prisma.branch.findMany({ where: { status: "active" }, orderBy: { name: "asc" } });
    const data: PublicBranch[] = rows.map((b) => compact({ id: b.id, name: b.name, country: b.country, city: b.city, address: b.address, phone: b.phone, email: b.email ?? undefined, openingHours: b.openingHours ?? undefined, mapUrl: b.mapUrl ?? undefined }));
    return ok(res, data);
  }),
);

publicRouter.get(
  "/pages/:slug",
  handler(async (req, res) => {
    const p = await prisma.page.findFirst({ where: { slug: String(req.params["slug"]), status: "published" } });
    if (!p) throw notFound("Trang không tồn tại");
    const data: PublicPage = compact({
      id: p.id,
      title: p.title,
      slug: p.slug,
      template: p.template,
      summary: p.summary ?? undefined,
      content: p.content ?? undefined,
      sections: p.sections as unknown as PublicPage["sections"],
      metaTitle: p.metaTitle ?? undefined,
      metaDescription: p.metaDescription ?? undefined,
      canonicalUrl: p.canonicalUrl ?? undefined,
      noindex: p.noindex,
      publishedAt: isoOrNull(p.publishedAt),
    });
    return ok(res, data);
  }),
);

publicRouter.get(
  "/sitemap",
  handler(async (_req, res) => {
    const [courses, articles, teachers] = await Promise.all([
      prisma.course.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true } }),
      prisma.article.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true, category: { select: { slug: true } } } }),
      prisma.teacher.findMany({ where: { status: "active" }, select: { slug: true, updatedAt: true } }),
    ]);
    const data: PublicSitemapEntry[] = [
      ...courses.map((c) => ({ type: "course" as const, slug: c.slug, lastModified: iso(c.updatedAt) })),
      ...articles.map((a) => ({ type: "article" as const, slug: a.slug, categorySlug: a.category.slug, lastModified: iso(a.updatedAt) })),
      ...teachers.map((t) => ({ type: "teacher" as const, slug: t.slug, lastModified: iso(t.updatedAt) })),
    ];
    return ok(res, data);
  }),
);

// ── Biểu mẫu & lead ────────────────────────────────────────────────────────
const findForm = (slug: string) => prisma.form.findFirst({ where: { slug, status: "active" } });

publicRouter.get(
  "/forms/:slug",
  handler(async (req, res) => {
    const f = await findForm(String(req.params["slug"]));
    if (!f) throw notFound("Biểu mẫu không tồn tại hoặc đã đóng");
    const data: PublicForm = compact({ id: f.id, name: f.name, slug: f.slug, type: f.type, description: f.description ?? undefined, fields: f.fields as unknown as FormFieldDef[], submitLabel: f.submitLabel, successMessage: f.successMessage, status: f.status });
    return ok(res, data);
  }),
);

/** Chống spam: giới hạn tốc độ theo IP (mặc định 20 lượt / 10 phút) + reCAPTCHA khi được bật. */
const submitLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: env.NODE_ENV === "test" ? 10_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, data: null, message: "Bạn gửi quá nhanh, vui lòng thử lại sau ít phút", errors: [], code: "TOO_MANY_REQUESTS" });
  },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s.-]{6,18}[0-9]$/;

publicRouter.post(
  "/forms/:slug/submit",
  submitLimiter,
  handler(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const form = await findForm(String(req.params["slug"]));
    if (!form) throw notFound("Biểu mẫu không tồn tại hoặc đã đóng");
    const { data, source, recaptchaToken } = parseBody(publicSubmitSchema, req.body);

    const fields = form.fields as unknown as FormFieldDef[];
    const errors: { field: string; message: string }[] = [];
    const cleaned: Record<string, string> = {};
    for (const f of fields) {
      const value = (data[f.key] ?? "").trim();
      if (f.required && (!value || (f.type === "checkbox" && value !== "true"))) {
        errors.push({ field: `data.${f.key}`, message: `${f.label} là bắt buộc` });
        continue;
      }
      if (!value) continue;
      if (f.type === "email" && !EMAIL_RE.test(value)) errors.push({ field: `data.${f.key}`, message: "Email không hợp lệ" });
      if (f.type === "phone" && !PHONE_RE.test(value)) errors.push({ field: `data.${f.key}`, message: "Số điện thoại không hợp lệ" });
      if (f.type === "select" && !f.options.includes(value)) errors.push({ field: `data.${f.key}`, message: "Lựa chọn không hợp lệ" });
      cleaned[f.key] = value.slice(0, 2000); // chỉ giữ khóa đã định nghĩa, cắt độ dài
    }
    if (errors.length) throw badRequest("Dữ liệu không hợp lệ", errors);

    const captcha = await verifyCaptcha(recaptchaToken, clientIp(req));
    if (!captcha.ok) throw badRequest(captcha.reason ?? "Xác minh thất bại", [{ field: "recaptchaToken", message: captcha.reason ?? "Xác minh thất bại" }]);

    const submission = await prisma.formSubmission.create({
      data: {
        formId: form.id,
        formName: form.name,
        formType: form.type,
        data: cleaned,
        fullName: cleaned["fullName"] ?? null,
        email: cleaned["email"]?.toLowerCase() ?? null,
        phone: cleaned["phone"] ?? null,
        status: "new",
        ...(source ? { source: JSON.parse(JSON.stringify(source)) as Prisma.InputJsonValue } : {}),
      },
    });

    // Báo cho tư vấn viên (không chặn phản hồi cho khách).
    if (form.notifyEmails.length > 0) {
      const body = [`Lead mới từ biểu mẫu "${form.name}"`, "", ...fields.filter((f) => cleaned[f.key]).map((f) => `${f.label}: ${cleaned[f.key]}`), "", source?.utmSource ? `Nguồn: ${source.utmSource}${source.utmCampaign ? ` / ${source.utmCampaign}` : ""}` : "", source?.landingPage ? `Trang: ${source.landingPage}` : ""].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
      void sendMail({ to: form.notifyEmails, subject: `[PTE iPASS] Lead mới: ${cleaned["fullName"] ?? form.name}`, text: body }).catch((error) => logger.error({ err: error }, "notify lead"));
    }
    return created(res, { id: submission.id, message: form.successMessage }, form.successMessage);
  }),
);

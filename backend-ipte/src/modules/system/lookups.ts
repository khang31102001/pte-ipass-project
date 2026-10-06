import type { Request } from "express";
import { Router } from "express";
import { authenticate } from "../../auth/middleware";
import { searchIds } from "../../core/crud/search";
import { prisma } from "../../core/db/prisma";
import { handler } from "../../core/http/async";
import { notFound } from "../../core/http/errors";
import { ok } from "../../core/http/response";

interface Option {
  value: string;
  label: string;
}
type Resolver = (q: string | undefined, parentId: string | undefined) => Promise<Option[]>;

const matching = async (table: string, columns: string[], q: string | undefined) => (q ? { id: { in: await searchIds(table, columns, q) } } : {});

const LOOKUPS: Record<string, Resolver> = {
  branches: async (q) => (await prisma.branch.findMany({ where: { status: "active", ...(await matching("branches", ["name", "code"], q)) }, orderBy: { name: "asc" } })).map((b) => ({ value: b.id, label: b.name })),
  staff: async (q) =>
    (await prisma.user.findMany({ where: { status: "active", ...(await matching("users", ["full_name", "email"], q)) }, include: { role: true }, orderBy: { fullName: "asc" } })).map((u) => ({ value: u.id, label: `${u.fullName} (${u.role.name})` })),
  roles: async () => (await prisma.role.findMany({ orderBy: { name: "asc" } })).map((r) => ({ value: r.id, label: r.name })),
  teachers: async (q) => (await prisma.teacher.findMany({ where: { status: { not: "inactive" }, ...(await matching("teachers", ["full_name", "code"], q)) }, orderBy: { fullName: "asc" } })).map((t) => ({ value: t.id, label: t.fullName })),
  courses: async (q) => (await prisma.course.findMany({ where: { ...(await matching("courses", ["name", "code"], q)) }, orderBy: { name: "asc" }, take: 200 })).map((c) => ({ value: c.id, label: c.name })),
  "course-categories": async () => (await prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })).map((c) => ({ value: c.id, label: c.name })),
  "article-categories": async () => (await prisma.articleCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })).map((c) => ({ value: c.id, label: c.name })),
  tags: async () => (await prisma.tag.findMany({ orderBy: { name: "asc" } })).map((t) => ({ value: t.id, label: t.name })),
  lessons: async (_q, parentId) => (await prisma.lesson.findMany({ where: parentId ? { courseId: parentId } : {}, orderBy: { position: "asc" }, take: 300 })).map((l) => ({ value: l.id, label: `${l.position}. ${l.title}` })),
  students: async (q) => (await prisma.student.findMany({ where: { ...(await matching("students", ["full_name", "code", "phone", "email"], q)) }, orderBy: { fullName: "asc" }, take: 50 })).map((s) => ({ value: s.id, label: `${s.code} – ${s.fullName}` })),
};

/** Danh sách chọn cho form (cần đăng nhập, không cần quyền riêng): GET /lookups/:name?q=&parentId= */
export const lookupsRouter = Router();
lookupsRouter.get(
  "/:name",
  authenticate,
  handler(async (req: Request, res) => {
    const resolver = LOOKUPS[String(req.params["name"])];
    if (!resolver) throw notFound("Danh sách tra cứu không tồn tại");
    const q = (req.query["q"] as string | undefined)?.trim() || undefined;
    const parentId = (req.query["parentId"] as string | undefined) || undefined;
    return ok(res, await resolver(q, parentId));
  }),
);

import type { Prisma } from "@prisma/client";
import { teacherSchema, type TeacherInput } from "../../contract/teachers/schemas";
import type { Teacher as TeacherDto } from "../../contract/teachers/types";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { nextCode, slugify } from "../../core/crud/codes";
import { compact, iso } from "../../core/crud/dto";
import { prisma, type Tx } from "../../core/db/prisma";
import { conflict } from "../../core/http/errors";

const include = { branch: true, courses: { include: { course: true } } } satisfies Prisma.TeacherInclude;
type TeacherRow = Prisma.TeacherGetPayload<{ include: typeof include }>;

const toDto = (t: TeacherRow): TeacherDto =>
  compact({
    id: t.id,
    code: t.code,
    fullName: t.fullName,
    email: t.email,
    phone: t.phone ?? undefined,
    avatarUrl: t.avatarUrl,
    headline: t.headline ?? undefined,
    bio: t.bio ?? undefined,
    pteScore: t.pteScore ?? undefined,
    yearsExperience: t.yearsExperience,
    specialties: t.specialties,
    qualifications: t.qualifications,
    branchId: t.branchId ?? undefined,
    branchName: t.branch?.name,
    status: t.status,
    availability: t.availability as unknown as TeacherDto["availability"],
    courses: t.courses.map((c) => ({ id: c.course.id, name: c.course.name })),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  });

/** Slug duy nhất từ họ tên (thêm hậu tố số khi trùng) — dùng cho URL công khai /doi-ngu-giao-vien/<slug>. */
async function uniqueSlug(tx: Tx, fullName: string, ignoreId?: string): Promise<string> {
  const base = slugify(fullName) || "giao-vien";
  for (let n = 0; ; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    const clash = await tx.teacher.findFirst({ where: { slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
  }
}

const fields = (i: TeacherInput) => ({
  fullName: i.fullName,
  email: i.email.toLowerCase(),
  phone: i.phone ?? null,
  headline: i.headline ?? null,
  bio: i.bio ?? null,
  pteScore: i.pteScore ?? null,
  yearsExperience: i.yearsExperience,
  specialties: i.specialties,
  qualifications: i.qualifications,
  branchId: i.branchId ?? null,
  status: i.status,
  availability: i.availability as unknown as Prisma.InputJsonValue,
});

export const teacherService = createCrudService<TeacherRow, TeacherDto, TeacherInput>({
  resource: "teacher",
  label: "giáo viên",
  table: "teachers",
  delegate: (db) => db.teacher,
  include,
  schema: teacherSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["full_name", "email", "code", "headline"],
  filters: {
    status: (v) => ({ status: v }),
    branchId: (v) => ({ branchId: v }),
    specialty: (v) => ({ specialties: { has: v } }),
  },
  sortable: {
    fullName: (d) => ({ fullName: d }),
    code: (d) => ({ code: d }),
    pteScore: (d) => ({ pteScore: d }),
    yearsExperience: (d) => ({ yearsExperience: d }),
    createdAt: (d) => ({ createdAt: d }),
    status: (d) => ({ status: d }),
  },
  defaultSort: { sortBy: "fullName", sortOrder: "asc" },
  entityLabel: (t) => `${t.code} – ${t.fullName}`,
  uniqueFields: { email: { field: "email", message: "Email đã được sử dụng" } },
  toCreateData: async (input, { tx }) => ({
    ...fields(input),
    code: await nextCode(tx, "teacher", "GV-", 3),
    slug: await uniqueSlug(tx, input.fullName),
  }),
  // Slug giữ ổn định sau khi tạo (đổi tên không làm gãy URL đã index).
  toUpdateData: (input) => fields(input),
  beforeDelete: (t) => {
    if (t.courses.length > 0) {
      throw conflict(`Giáo viên đang phụ trách ${t.courses.length} khóa học (${t.courses.map((c) => c.course.name).join(", ")}). Hãy chuyển phụ trách trước khi xóa.`);
    }
  },
});

export const teachersRouter = crudRouter("teacher", teacherService, { label: "giáo viên" });
export const teacherLookup = () => prisma.teacher.findMany({ where: { status: { not: "inactive" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } });

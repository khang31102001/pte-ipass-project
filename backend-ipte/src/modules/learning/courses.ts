import type { Prisma } from "@prisma/client";
import { courseCategorySchema, courseSchema, lessonSchema, type CourseCategoryInput, type CourseInput, type LessonInput } from "../../contract/courses/schemas";
import type { Course as CourseDto, CourseCategory as CategoryDto, Lesson as LessonDto } from "../../contract/courses/types";
import type { PteLevel, PteTargetScore } from "../../contract/domain/pte";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, iso } from "../../core/crud/dto";
import { publishGuard } from "../../core/crud/guards";
import { conflict } from "../../core/http/errors";

// ── Danh mục khóa học ──────────────────────────────────────────────────────
const catInclude = { parent: true, _count: { select: { courses: true, children: true } } } satisfies Prisma.CourseCategoryInclude;
type CatRow = Prisma.CourseCategoryGetPayload<{ include: typeof catInclude }>;

const toCategoryDto = (c: CatRow): CategoryDto =>
  compact({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? undefined,
    parentId: c.parentId,
    parentName: c.parent?.name,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    courseCount: c._count.courses,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  }) as CategoryDto;

const catData = (i: CourseCategoryInput) => ({ name: i.name, slug: i.slug, description: i.description ?? null, parentId: i.parentId ?? null, sortOrder: i.sortOrder, isActive: i.isActive });

export const courseCategoryService = createCrudService<CatRow, CategoryDto, CourseCategoryInput>({
  resource: "course",
  label: "danh mục khóa học",
  table: "course_categories",
  delegate: (db) => db.courseCategory,
  include: catInclude,
  schema: courseCategorySchema,
  toDtos: (rows) => rows.map(toCategoryDto),
  searchColumns: ["name", "slug", "description"],
  filters: { isActive: (v) => ({ isActive: v === "true" }), parentId: (v) => ({ parentId: v }) },
  sortable: { name: (d) => ({ name: d }), sortOrder: (d) => ({ sortOrder: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "sortOrder", sortOrder: "asc" },
  entityLabel: (c) => c.name,
  uniqueFields: { slug: { field: "slug", message: "Slug đã tồn tại" }, name: { field: "name", message: "Tên danh mục đã tồn tại" } },
  guard: ({ input, current }) => {
    if (current && input.parentId === current.id) throw conflict("Danh mục không thể là cha của chính nó");
  },
  toCreateData: catData,
  toUpdateData: catData,
  beforeDelete: (c) => {
    if (c._count.courses > 0) throw conflict("Danh mục còn khóa học, hãy chuyển khóa học sang danh mục khác trước");
    if (c._count.children > 0) throw conflict("Danh mục còn danh mục con");
  },
});

// ── Khóa học ────────────────────────────────────────────────────────────────
const include = { category: true, teachers: { include: { teacher: true } }, _count: { select: { lessons: true } } } satisfies Prisma.CourseInclude;
type CourseRow = Prisma.CourseGetPayload<{ include: typeof include }>;

const toCourseDto = (c: CourseRow): CourseDto =>
  compact({
    id: c.id,
    code: c.code,
    name: c.name,
    slug: c.slug,
    categoryId: c.categoryId,
    categoryName: c.category.name,
    type: c.type,
    targetScore: (c.targetScore ?? undefined) as PteTargetScore | undefined,
    entryLevel: c.entryLevel as PteLevel,
    mode: c.mode,
    durationWeeks: c.durationWeeks,
    sessionsCount: c.sessionsCount,
    tuition: c.tuition,
    teacherIds: c.teachers.map((t) => t.teacherId),
    teacherNames: c.teachers.map((t) => t.teacher.fullName),
    summary: c.summary,
    description: c.description ?? undefined,
    outcomes: c.outcomes,
    audience: c.audience,
    status: c.status,
    isFeatured: c.isFeatured,
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    metaTitle: c.metaTitle ?? undefined,
    metaDescription: c.metaDescription ?? undefined,
    lessonCount: c._count.lessons,
    enrolledCount: c.enrolledCount,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  });

const courseFields = (i: CourseInput) => ({
  name: i.name,
  slug: i.slug,
  categoryId: i.categoryId,
  type: i.type,
  targetScore: i.targetScore ?? null,
  entryLevel: i.entryLevel,
  mode: i.mode,
  durationWeeks: i.durationWeeks,
  sessionsCount: i.sessionsCount,
  tuition: i.tuition,
  summary: i.summary,
  description: i.description ?? null,
  outcomes: i.outcomes,
  audience: i.audience,
  status: i.status,
  isFeatured: i.isFeatured,
  thumbnailUrl: i.thumbnailUrl ?? null,
  metaTitle: i.metaTitle ?? null,
  metaDescription: i.metaDescription ?? null,
});

const teacherLinks = (ids: string[]) => [...new Set(ids)].map((teacherId) => ({ teacher: { connect: { id: teacherId } } }));

export const courseService = createCrudService<CourseRow, CourseDto, CourseInput>({
  resource: "course",
  label: "khóa học",
  table: "courses",
  delegate: (db) => db.course,
  include,
  schema: courseSchema,
  toDtos: (rows) => rows.map(toCourseDto),
  searchColumns: ["name", "code", "summary", "slug"],
  filters: {
    status: (v) => ({ status: v }),
    type: (v) => ({ type: v }),
    categoryId: (v) => ({ categoryId: v }),
    mode: (v) => ({ mode: v }),
    targetScore: (v) => ({ targetScore: Number(v) }),
    isFeatured: (v) => ({ isFeatured: v === "true" }),
  },
  sortable: {
    name: (d) => ({ name: d }),
    code: (d) => ({ code: d }),
    tuition: (d) => ({ tuition: d }),
    targetScore: (d) => ({ targetScore: d }),
    durationWeeks: (d) => ({ durationWeeks: d }),
    createdAt: (d) => ({ createdAt: d }),
    status: (d) => ({ status: d }),
    enrolledCount: (d) => ({ enrolledCount: d }),
  },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (c) => `${c.code} – ${c.name}`,
  uniqueFields: { code: { field: "code", message: "Mã khóa học đã tồn tại" }, slug: { field: "slug", message: "Slug đã tồn tại" } },
  guard: publishGuard<CourseRow>("course"),
  toCreateData: (input) => ({ ...courseFields(input), code: input.code, teachers: { create: teacherLinks(input.teacherIds) } }),
  toUpdateData: (input) => ({ ...courseFields(input), code: input.code, teachers: { deleteMany: {}, create: teacherLinks(input.teacherIds) } }),
});

// ── Bài học ─────────────────────────────────────────────────────────────────
const lessonInclude = { _count: { select: { materials: true } } } satisfies Prisma.LessonInclude;
type LessonRow = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;

const toLessonDto = (l: LessonRow): LessonDto =>
  compact({
    id: l.id,
    courseId: l.courseId,
    title: l.title,
    order: l.position,
    type: l.type,
    skill: l.skill ?? undefined,
    durationMinutes: l.durationMinutes,
    objectives: l.objectives ?? undefined,
    status: l.status,
    materialCount: l._count.materials,
    createdAt: iso(l.createdAt),
    updatedAt: iso(l.updatedAt),
  });

const lessonData = (i: LessonInput) => ({ courseId: i.courseId, title: i.title, position: i.order, type: i.type, skill: i.skill ?? null, durationMinutes: i.durationMinutes, objectives: i.objectives ?? null, status: i.status });

export const lessonService = createCrudService<LessonRow, LessonDto, LessonInput>({
  resource: "lesson",
  label: "bài học",
  table: "lessons",
  delegate: (db) => db.lesson,
  include: lessonInclude,
  schema: lessonSchema,
  toDtos: (rows) => rows.map(toLessonDto),
  searchColumns: ["title", "objectives"],
  filters: { courseId: (v) => ({ courseId: v }), type: (v) => ({ type: v }), status: (v) => ({ status: v }) },
  sortable: { order: (d) => ({ position: d }), title: (d) => ({ title: d }), durationMinutes: (d) => ({ durationMinutes: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "order", sortOrder: "asc" },
  entityLabel: (l) => l.title,
  toCreateData: lessonData,
  toUpdateData: lessonData,
  beforeDelete: (l) => {
    if (l._count.materials > 0) throw conflict("Bài học còn học liệu, hãy gỡ học liệu trước khi xóa");
  },
});

export const courseCategoriesRouter = crudRouter("course", courseCategoryService, { label: "danh mục khóa học" });
export const coursesRouter = crudRouter("course", courseService, { label: "khóa học" });
export const lessonsRouter = crudRouter("lesson", lessonService, { label: "bài học" });

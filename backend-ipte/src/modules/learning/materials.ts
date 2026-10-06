import type { Prisma } from "@prisma/client";
import { materialSchema, type MaterialInput } from "../../contract/learning-materials/schemas";
import type { LearningMaterial as MaterialDto } from "../../contract/learning-materials/types";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, iso } from "../../core/crud/dto";

const include = { course: { select: { name: true } }, lesson: { select: { title: true } } } satisfies Prisma.LearningMaterialInclude;
type Row = Prisma.LearningMaterialGetPayload<{ include: typeof include }>;

const toDto = (m: Row): MaterialDto =>
  compact({
    id: m.id,
    title: m.title,
    type: m.type,
    url: m.url,
    description: m.description ?? undefined,
    skill: m.skill ?? undefined,
    questionType: (m.questionType ?? undefined) as MaterialDto["questionType"],
    courseId: m.courseId ?? undefined,
    courseName: m.course?.name,
    lessonId: m.lessonId ?? undefined,
    lessonTitle: m.lesson?.title,
    fileSizeKb: m.fileSizeKb ?? undefined,
    durationSeconds: m.durationSeconds ?? undefined,
    tags: m.tags,
    visibility: m.visibility,
    status: m.status,
    createdAt: iso(m.createdAt),
    updatedAt: iso(m.updatedAt),
  });

const data = (i: MaterialInput) => ({
  title: i.title,
  type: i.type,
  url: i.url,
  description: i.description ?? null,
  skill: i.skill ?? null,
  questionType: i.questionType ?? null,
  courseId: i.courseId ?? null,
  lessonId: i.lessonId ?? null,
  fileSizeKb: i.fileSizeKb ?? null,
  durationSeconds: i.durationSeconds ?? null,
  tags: i.tags,
  visibility: i.visibility,
  status: i.status,
});

export const materialService = createCrudService<Row, MaterialDto, MaterialInput>({
  resource: "learning_material",
  label: "học liệu",
  table: "learning_materials",
  delegate: (db) => db.learningMaterial,
  include,
  schema: materialSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["title", "description"],
  filters: {
    type: (v) => ({ type: v }),
    skill: (v) => ({ skill: v }),
    courseId: (v) => ({ courseId: v }),
    lessonId: (v) => ({ lessonId: v }),
    visibility: (v) => ({ visibility: v }),
    status: (v) => ({ status: v }),
  },
  sortable: { title: (d) => ({ title: d }), type: (d) => ({ type: d }), createdAt: (d) => ({ createdAt: d }), updatedAt: (d) => ({ updatedAt: d }), status: (d) => ({ status: d }) },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (m) => m.title,
  toCreateData: data,
  toUpdateData: data,
});

export const materialsRouter = crudRouter("learning_material", materialService, { label: "học liệu" });

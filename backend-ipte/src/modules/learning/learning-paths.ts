import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { authenticate, requirePermission } from "../../auth/middleware";
import type { PteLevel } from "../../contract/domain/pte";
import { generatePathSchema, learningPathSchema, type GeneratePathInput, type LearningPathInput } from "../../contract/learning-paths/schemas";
import type { GeneratedPath, LearningPath as PathDto, PathStep } from "../../contract/learning-paths/types";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, day, iso, parseDay } from "../../core/crud/dto";
import { prisma } from "../../core/db/prisma";
import { handler } from "../../core/http/async";
import { ok } from "../../core/http/response";
import { parseBody } from "../../core/http/validate";

const include = { student: { select: { fullName: true, code: true } }, steps: { orderBy: { position: "asc" }, include: { course: { select: { name: true } } } } } satisfies Prisma.LearningPathInclude;
type Row = Prisma.LearningPathGetPayload<{ include: typeof include }>;

const toDto = (p: Row): PathDto => {
  const done = p.steps.filter((s) => s.status === "done").length;
  return compact({
    id: p.id,
    studentId: p.studentId,
    studentName: p.student.fullName,
    studentCode: p.student.code,
    title: p.title,
    currentLevel: p.currentLevel as PteLevel,
    targetScore: p.targetScore,
    deadline: day(p.deadline),
    startDate: day(p.startDate) as string,
    weeklyHours: p.weeklyHours,
    status: p.status,
    steps: p.steps.map(
      (s): PathStep =>
        compact({
          title: s.title,
          courseId: s.courseId ?? undefined,
          courseName: s.course?.name,
          targetScore: s.targetScore ?? undefined,
          startDate: day(s.startDate) as string,
          endDate: day(s.endDate) as string,
          status: s.status,
          note: s.note ?? undefined,
        }),
    ),
    progress: p.steps.length ? Math.round((done / p.steps.length) * 100) : 0,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  });
};

const stepRows = (steps: LearningPathInput["steps"]) =>
  steps.map((s, position) => ({
    position: position + 1,
    title: s.title,
    courseId: s.courseId ?? null,
    targetScore: s.targetScore ?? null,
    startDate: parseDay(s.startDate) as Date,
    endDate: parseDay(s.endDate) as Date,
    status: s.status,
    note: s.note ?? null,
  }));

const fields = (i: LearningPathInput) => ({
  studentId: i.studentId,
  title: i.title,
  currentLevel: i.currentLevel,
  targetScore: i.targetScore,
  deadline: parseDay(i.deadline),
  startDate: parseDay(i.startDate) as Date,
  weeklyHours: i.weeklyHours,
  status: i.status,
});

export const learningPathService = createCrudService<Row, PathDto, LearningPathInput>({
  resource: "learning_path",
  label: "lộ trình học",
  table: "learning_paths",
  delegate: (db) => db.learningPath,
  include,
  schema: learningPathSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["title"],
  filters: { status: (v) => ({ status: v }), studentId: (v) => ({ studentId: v }) },
  sortable: { title: (d) => ({ title: d }), createdAt: (d) => ({ createdAt: d }), targetScore: (d) => ({ targetScore: d }), status: (d) => ({ status: d }), deadline: (d) => ({ deadline: d }) },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (p) => p.title,
  toCreateData: (input) => ({ ...fields(input), steps: { create: stepRows(input.steps) } }),
  toUpdateData: (input) => ({ ...fields(input), steps: { deleteMany: {}, create: stepRows(input.steps) } }),
});

// ── Gợi ý lộ trình ──────────────────────────────────────────────────────────
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
const levelScore = (l: PteLevel) => (l === "none" ? 20 : Number(l));

interface CandidateCourse {
  id: string;
  name: string;
  type: string;
  targetScore: number | null;
  entryLevel: string;
  durationWeeks: number;
}

/**
 * Gợi ý lộ trình: chọn khóa đang mở có mốc điểm nằm giữa trình độ hiện tại và mục tiêu (tham lam, ít bước nhất),
 * xếp tuần tự, điều chỉnh thời lượng theo giờ học/tuần (khóa thiết kế cho ~10 giờ/tuần), rồi kiểm tra kịp hạn chứng chỉ.
 */
export function buildPath(input: GeneratePathInput, published: CandidateCourse[]): GeneratedPath {
  const from = levelScore(input.currentLevel);
  const stepCourses = published.filter((c) => (c.type === "target_score" || c.type === "preparation") && c.targetScore !== null);

  let chosen: CandidateCourse[] = [];
  let score = from;
  if (input.currentLevel === "none") {
    const pre = published.find((c) => c.type === "preparation");
    if (pre) {
      chosen.push(pre);
      score = pre.targetScore ?? 30;
    }
  }
  while (score < input.targetScore) {
    const next = stepCourses
      .filter((c) => (c.targetScore ?? 0) > score && (c.targetScore ?? 0) <= input.targetScore && levelScore(c.entryLevel as PteLevel) <= score + 6)
      .sort((a, b) => (b.targetScore ?? 0) - (a.targetScore ?? 0))[0];
    if (!next) break;
    chosen.push(next);
    score = next.targetScore ?? score;
  }
  chosen = chosen.filter((c, i) => chosen.findIndex((x) => x.id === c.id) === i);
  if (chosen.length === 0) {
    const fast = published.filter((c) => c.type === "intensive" && (c.targetScore ?? 0) >= input.targetScore).sort((a, b) => (a.targetScore ?? 0) - (b.targetScore ?? 0))[0];
    if (fast) chosen = [fast];
  }

  const warnings: string[] = [];
  if (chosen.length === 0) warnings.push("Chưa có khóa học phù hợp với mục tiêu này. Hãy thêm bước thủ công.");

  let cursor = input.startDate;
  const steps: PathStep[] = chosen.map((c) => {
    const weeks = Math.max(c.durationWeeks, Math.ceil((c.durationWeeks * 10) / input.weeklyHours));
    const endDate = addDays(cursor, weeks * 7 - 1);
    const step: PathStep = compact({ title: c.name, courseId: c.id, courseName: c.name, targetScore: c.targetScore ?? undefined, startDate: cursor, endDate, status: "pending" as const });
    cursor = addDays(endDate, 1);
    return step;
  });

  const endDate = steps.length ? (steps[steps.length - 1] as PathStep).endDate : input.startDate;
  const estimatedWeeks = Math.round((Date.parse(endDate) - Date.parse(input.startDate)) / (7 * 86_400_000)) + (steps.length ? 1 : 0);
  let feasible = true;
  if (input.deadline && steps.length) {
    feasible = endDate <= input.deadline;
    if (!feasible) {
      const lateWeeks = Math.ceil((Date.parse(endDate) - Date.parse(input.deadline)) / (7 * 86_400_000));
      warnings.push(`Dự kiến hoàn thành ${endDate}, trễ hạn chứng chỉ khoảng ${lateWeeks} tuần. Cân nhắc tăng giờ học/tuần hoặc chọn khóa cấp tốc.`);
    }
  }
  if (input.weeklyHours < 5) warnings.push("Dưới 5 giờ/tuần thường khó đạt tiến bộ ổn định.");
  return { steps, estimatedWeeks, endDate, feasible, warnings };
}

export const learningPathsRouter = Router();

learningPathsRouter.post(
  "/generate",
  authenticate,
  requirePermission("learning_path.view"),
  handler(async (req, res) => {
    const input = parseBody(generatePathSchema, req.body);
    const published = await prisma.course.findMany({ where: { status: "published" }, select: { id: true, name: true, type: true, targetScore: true, entryLevel: true, durationWeeks: true } });
    return ok(res, buildPath(input, published));
  }),
);
learningPathsRouter.use(crudRouter("learning_path", learningPathService, { label: "lộ trình học" }));

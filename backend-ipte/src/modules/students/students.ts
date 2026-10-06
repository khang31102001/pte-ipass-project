import type { JourneyEvent as JourneyEventRow, Prisma, StudentProfile as ProfileRow } from "@prisma/client";
import { Router } from "express";
import { authenticate, requirePermission } from "../../auth/middleware";
import { JOURNEY_STAGES, JOURNEY_STAGE_LABELS, type PteLevel } from "../../contract/domain/pte";
import { advanceJourneySchema, journeyNoteSchema, studentProfileSchema, studentSchema, type StudentInput } from "../../contract/students/schemas";
import type { JourneyEvent as JourneyEventDto, Student as StudentDto, StudentJourney, StudentProfile as ProfileDto } from "../../contract/students/types";
import { writeAudit } from "../../core/audit/audit";
import { nextCode } from "../../core/crud/codes";
import { crudRouter, UUID } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, day, iso, parseDay } from "../../core/crud/dto";
import { prisma } from "../../core/db/prisma";
import { handler } from "../../core/http/async";
import { conflict, notFound } from "../../core/http/errors";
import { created, ok } from "../../core/http/response";
import { parseBody } from "../../core/http/validate";

const include = { branch: { select: { name: true } }, assignee: { select: { fullName: true } }, profile: { select: { targetScore: true, examDeadline: true, purpose: true } } } satisfies Prisma.StudentInclude;
type Row = Prisma.StudentGetPayload<{ include: typeof include }>;

const toDto = (s: Row): StudentDto =>
  compact({
    id: s.id,
    code: s.code,
    fullName: s.fullName,
    gender: s.gender,
    dateOfBirth: day(s.dateOfBirth),
    email: s.email,
    phone: s.phone,
    zalo: s.zalo ?? undefined,
    city: s.city ?? undefined,
    address: s.address ?? undefined,
    source: s.source,
    branchId: s.branchId ?? undefined,
    branchName: s.branch?.name,
    assignedTo: s.assignedTo ?? undefined,
    assignedToName: s.assignee?.fullName,
    status: s.status,
    stage: s.stage,
    tags: s.tags,
    notes: s.notes ?? undefined,
    targetScore: s.profile?.targetScore,
    examDeadline: day(s.profile?.examDeadline),
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
  });

const fields = (i: StudentInput) => ({
  fullName: i.fullName,
  gender: i.gender,
  dateOfBirth: parseDay(i.dateOfBirth),
  email: i.email.toLowerCase(),
  phone: i.phone,
  zalo: i.zalo ?? null,
  city: i.city ?? null,
  address: i.address ?? null,
  source: i.source,
  branchId: i.branchId ?? null,
  assignedTo: i.assignedTo ?? null,
  status: i.status,
  tags: i.tags ?? [],
  notes: i.notes ?? null,
});

const eventDto = (e: JourneyEventRow): JourneyEventDto =>
  compact({
    id: e.id,
    studentId: e.studentId,
    kind: e.kind,
    stage: e.stage,
    title: e.title,
    note: e.note ?? undefined,
    data: (e.data ?? undefined) as JourneyEventDto["data"],
    createdByName: e.createdByName,
    occurredAt: iso(e.occurredAt),
    createdAt: iso(e.createdAt),
    updatedAt: iso(e.createdAt),
  });

const profileDto = (p: ProfileRow): ProfileDto =>
  compact({
    id: p.studentId,
    studentId: p.studentId,
    currentLevel: p.currentLevel as PteLevel,
    currentScore: p.currentScore ?? undefined,
    skillScores: (p.skillScores ?? undefined) as ProfileDto["skillScores"],
    targetScore: p.targetScore,
    purpose: p.purpose,
    purposeDetail: p.purposeDetail ?? undefined,
    targetCountry: p.targetCountry ?? undefined,
    examDeadline: day(p.examDeadline),
    studyHoursPerWeek: p.studyHoursPerWeek ?? undefined,
    preferredMode: p.preferredMode,
    preferredSchedule: p.preferredSchedule ?? undefined,
    notes: p.notes ?? undefined,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  });

export const studentService = createCrudService<Row, StudentDto, StudentInput>({
  resource: "student",
  label: "học viên",
  table: "students",
  delegate: (db) => db.student,
  include,
  schema: studentSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["full_name", "email", "phone", "code", "zalo"],
  filters: {
    stage: (v) => ({ stage: v }),
    status: (v) => ({ status: v }),
    source: (v) => ({ source: v }),
    branchId: (v) => ({ branchId: v }),
    assignedTo: (v) => ({ assignedTo: v }),
    purpose: (v) => ({ profile: { is: { purpose: v } } }),
  },
  sortable: {
    fullName: (d) => ({ fullName: d }),
    code: (d) => ({ code: d }),
    createdAt: (d) => ({ createdAt: d }),
    updatedAt: (d) => ({ updatedAt: d }),
    stage: (d) => ({ stage: d }),
    status: (d) => ({ status: d }),
    targetScore: (d) => ({ profile: { targetScore: d } }),
    examDeadline: (d) => ({ profile: { examDeadline: d } }),
  },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (s) => `${s.code} – ${s.fullName}`,
  uniqueFields: { email: { field: "email", message: "Email đã tồn tại trong hệ thống" } },
  exportable: true,
  toCreateData: async (input, { tx }) => ({ ...fields(input), code: await nextCode(tx, "student", "HV-", 5), stage: "lead" }),
  toUpdateData: (input) => fields(input),
  // Mọi học viên mới đều có sự kiện đầu tiên của hành trình (Lead) — đảm bảo funnel/báo cáo đúng.
  afterCreate: async (s, _input, { tx, auth }) => {
    await tx.journeyEvent.create({
      data: { studentId: s.id, kind: "stage", stage: "lead", title: `Tạo hồ sơ học viên (${JOURNEY_STAGE_LABELS.lead})`, note: `Nguồn: ${s.source}`, createdByName: auth?.name ?? "Hệ thống", occurredAt: new Date() },
    });
  },
});

export const studentsRouter = Router();
const guard = [authenticate];
const idOk = (id: string) => {
  if (!UUID.test(id)) throw notFound("Không tìm thấy học viên");
  return id;
};

studentsRouter.get(
  "/:id/profile",
  ...guard,
  requirePermission("student.view"),
  handler(async (req, res) => {
    const id = idOk(String(req.params["id"]));
    if (!(await prisma.student.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Không tìm thấy học viên");
    const profile = await prisma.studentProfile.findUnique({ where: { studentId: id } });
    return ok(res, profile ? profileDto(profile) : null);
  }),
);

studentsRouter.put(
  "/:id/profile",
  ...guard,
  requirePermission("student.edit"),
  handler(async (req, res) => {
    const id = idOk(String(req.params["id"]));
    const input = parseBody(studentProfileSchema, req.body);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw notFound("Không tìm thấy học viên");
    const data = {
      currentLevel: input.currentLevel,
      currentScore: input.currentScore ?? null,
      skillScores: (input.skillScores ?? undefined) as Prisma.InputJsonValue | undefined,
      targetScore: input.targetScore,
      purpose: input.purpose,
      purposeDetail: input.purposeDetail ?? null,
      targetCountry: input.targetCountry ?? null,
      examDeadline: parseDay(input.examDeadline),
      studyHoursPerWeek: input.studyHoursPerWeek ?? null,
      preferredMode: input.preferredMode,
      preferredSchedule: input.preferredSchedule ?? null,
      notes: input.notes ?? null,
    };
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.studentProfile.findUnique({ where: { studentId: id } });
      const after = await tx.studentProfile.upsert({ where: { studentId: id }, create: { studentId: id, ...data }, update: data });
      await writeAudit(req.auth, { action: before ? "update" : "create", resource: "student", entityId: id, entityLabel: `Hồ sơ PTE – ${student.fullName}`, before, after }, tx);
      return after;
    });
    return ok(res, profileDto(result));
  }),
);

studentsRouter.get(
  "/:id/journey",
  ...guard,
  requirePermission("student.view"),
  handler(async (req, res) => {
    const id = idOk(String(req.params["id"]));
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw notFound("Không tìm thấy học viên");
    const events = await prisma.journeyEvent.findMany({ where: { studentId: id }, orderBy: { occurredAt: "desc" } });
    const journey: StudentJourney = { studentId: id, currentStage: student.stage, events: events.map(eventDto) };
    return ok(res, journey);
  }),
);

/** Hành trình chỉ chuyển tiến; thi thật cần ngày thi, kết quả cần điểm (đã kiểm ở schema). */
studentsRouter.post(
  "/:id/journey/advance",
  ...guard,
  requirePermission("student.edit"),
  handler(async (req, res) => {
    const id = idOk(String(req.params["id"]));
    const input = parseBody(advanceJourneySchema, req.body);
    const event = await prisma.$transaction(async (tx) => {
      // Khóa hàng để hai request đồng thời không cùng chuyển giai đoạn.
      const rows = await tx.$queryRaw<{ stage: string; full_name: string }[]>`SELECT stage::text, full_name FROM students WHERE id = ${id}::uuid FOR UPDATE`;
      const current = rows[0];
      if (!current) throw notFound("Không tìm thấy học viên");
      const currentStage = current.stage as (typeof JOURNEY_STAGES)[number];
      if (JOURNEY_STAGES.indexOf(input.stage) <= JOURNEY_STAGES.indexOf(currentStage)) {
        throw conflict(`Học viên đang ở giai đoạn "${JOURNEY_STAGE_LABELS[currentStage]}", chỉ được chuyển tiếp sang giai đoạn sau`);
      }
      const data = input.score !== undefined || input.examDate || input.passed !== undefined ? { score: input.score, examDate: input.examDate, passed: input.passed } : undefined;
      const created = await tx.journeyEvent.create({
        data: {
          studentId: id,
          kind: "stage",
          stage: input.stage,
          title: `Chuyển sang giai đoạn "${JOURNEY_STAGE_LABELS[input.stage]}"`,
          note: input.note ?? null,
          ...(data ? { data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue } : {}),
          createdByName: req.auth?.name ?? "Hệ thống",
          occurredAt: new Date(),
        },
      });
      await tx.student.update({ where: { id }, data: { stage: input.stage, ...(input.stage === "result" ? { status: "closed" } : {}) } });
      await writeAudit(req.auth, { action: "update", resource: "student", entityId: id, entityLabel: `Hành trình – ${current.full_name}`, before: { stage: currentStage }, after: { stage: input.stage } }, tx);
      return created;
    });
    return created(res, eventDto(event));
  }),
);

studentsRouter.post(
  "/:id/journey/notes",
  ...guard,
  requirePermission("student.edit"),
  handler(async (req, res) => {
    const id = idOk(String(req.params["id"]));
    const input = parseBody(journeyNoteSchema, req.body);
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw notFound("Không tìm thấy học viên");
    const event = await prisma.journeyEvent.create({ data: { studentId: id, kind: "note", stage: student.stage, title: "Ghi chú", note: input.note, createdByName: req.auth?.name ?? "Hệ thống", occurredAt: new Date() } });
    return created(res, eventDto(event));
  }),
);

studentsRouter.use(crudRouter("student", studentService, { label: "học viên", exportable: true }));

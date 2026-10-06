import type { Prisma } from "@prisma/client";
import { Router, type Request } from "express";
import { authenticate, requirePermission } from "../../auth/middleware";
import type { CountByKey, DailyPoint, DashboardSummary, EnrollmentGroupBy, EnrollmentReport, FunnelReport, FunnelStep, LeadSourceReport } from "../../contract/dashboard/types";
import { JOURNEY_STAGES } from "../../contract/domain/pte";
import { FORM_TYPE_LABELS } from "../../contract/forms/types";
import { LEAD_SOURCE_LABELS } from "../../contract/students/types";
import { writeAudit } from "../../core/audit/audit";
import { prisma } from "../../core/db/prisma";
import { handler } from "../../core/http/async";
import { ok } from "../../core/http/response";

const DAY = 86_400_000;
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Khoảng thời gian: ?from&to (yyyy-MM-dd) hoặc ?days (mặc định theo từng báo cáo). */
function resolveRange(req: Request, defaultDays: number) {
  const q = req.query as Record<string, string | undefined>;
  const to = q["to"] ? Date.parse(`${q["to"]}T23:59:59.999Z`) : Date.now();
  const days = Math.max(1, Math.min(730, Number(q["days"]) || defaultDays));
  const from = q["from"] ? Date.parse(`${q["from"]}T00:00:00.000Z`) : to - days * DAY;
  return { from: new Date(from), to: new Date(to), fromMs: from, toMs: to, fromDay: toDay(from), toDay: toDay(to), days: Math.max(1, Math.round((to - from) / DAY)) };
}

function dailySeries(dates: Date[], fromMs: number, toMs: number): DailyPoint[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    const k = d.toISOString().slice(0, 10);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const points: DailyPoint[] = [];
  for (let t = Math.floor(fromMs / DAY) * DAY; t <= toMs; t += DAY) points.push({ date: toDay(t), count: map.get(toDay(t)) ?? 0 });
  return points;
}

function countBy<T>(items: T[], key: (i: T) => string, label: (k: string) => string): CountByKey[] {
  const map = new Map<string, number>();
  for (const it of items) map.set(key(it), (map.get(key(it)) ?? 0) + 1);
  return [...map.entries()].map(([k, count]) => ({ key: k, label: label(k), count })).sort((a, b) => b.count - a.count);
}

interface Lead {
  id: string;
  createdAt: Date;
  status: string;
  formType: string;
  formName: string;
  fullName: string | null;
  phone: string | null;
  source: Prisma.JsonValue;
}

const sourceOf = (l: Lead): string => {
  const s = (l.source ?? {}) as { utmSource?: string; referrer?: string };
  return s.utmSource ?? (s.referrer ? "referral" : "direct");
};
const SOURCE_LABELS: Record<string, string> = { ...LEAD_SOURCE_LABELS, direct: "Trực tiếp", referral: "Giới thiệu / Referral" };
const sourceLabel = (k: string) => SOURCE_LABELS[k] ?? k;

const leadsIn = (from: Date, to: Date): Promise<Lead[]> =>
  prisma.formSubmission.findMany({
    where: { status: { not: "spam" }, createdAt: { gte: from, lte: to } },
    select: { id: true, createdAt: true, status: true, formType: true, formName: true, fullName: true, phone: true, source: true },
  });

/** Phễu: số học viên đã đi QUA từng giai đoạn (stage hiện tại ≥ giai đoạn đó). */
function buildFunnel(byStage: Map<string, number>): FunnelStep[] {
  const counts = JOURNEY_STAGES.map((_, i) => JOURNEY_STAGES.slice(i).reduce((sum, st) => sum + (byStage.get(st) ?? 0), 0));
  const top = counts[0] ?? 0;
  return JOURNEY_STAGES.map((stage, i) => ({
    stage,
    count: counts[i] ?? 0,
    conversionFromPrevious: i === 0 ? null : (counts[i - 1] ?? 0) === 0 ? 0 : round1(((counts[i] ?? 0) / (counts[i - 1] as number)) * 100),
    conversionFromTop: top === 0 ? 0 : round1(((counts[i] ?? 0) / top) * 100),
  }));
}

async function studentsByStage(from: Date, to: Date, branchId?: string): Promise<Map<string, number>> {
  const rows = await prisma.student.groupBy({ by: ["stage"], where: { createdAt: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.stage, r._count._all]));
}

const stageEvents = (stage: "enroll" | "result", from: Date, to: Date) =>
  prisma.journeyEvent.findMany({ where: { kind: "stage", stage, occurredAt: { gte: from, lte: to } }, select: { studentId: true, occurredAt: true, data: true } });

type EventData = { score?: number; examDate?: string; passed?: boolean } | null;

export const reportsRouter = Router();
export const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  authenticate,
  requirePermission("dashboard.view"),
  handler(async (req, res) => {
    const r = resolveRange(req, 90);
    const span = r.toMs - r.fromMs;
    const [leads, prevLeadCount, activeLearners, results, enrollCount, byStage, recent, exams] = await Promise.all([
      leadsIn(r.from, r.to),
      prisma.formSubmission.count({ where: { status: { not: "spam" }, createdAt: { gte: new Date(r.fromMs - span), lte: new Date(r.fromMs - 1) } } }),
      prisma.student.count({ where: { stage: { in: ["learn", "mock"] } } }),
      stageEvents("result", r.from, r.to),
      prisma.journeyEvent.count({ where: { kind: "stage", stage: "enroll", occurredAt: { gte: r.from, lte: r.to } } }),
      studentsByStage(r.from, r.to),
      prisma.formSubmission.findMany({ where: { status: { not: "spam" } }, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.student.findMany({ where: { stage: { in: ["exam", "mock"] } }, take: 6, orderBy: { updatedAt: "desc" }, include: { profile: { select: { targetScore: true } }, events: { where: { stage: "exam" }, take: 1, orderBy: { occurredAt: "desc" } } } }),
    ]);

    const passed = results.filter((e) => (e.data as EventData)?.passed).length;
    // Điểm tăng = điểm kết quả − điểm test đầu vào của cùng học viên.
    const tests = results.length
      ? await prisma.journeyEvent.findMany({ where: { kind: "stage", stage: "test", studentId: { in: results.map((e) => e.studentId) } }, select: { studentId: true, data: true } })
      : [];
    const gains = results
      .map((e) => {
        const end = (e.data as EventData)?.score;
        const start = (tests.find((t) => t.studentId === e.studentId)?.data as EventData)?.score;
        return typeof end === "number" && typeof start === "number" ? end - start : undefined;
      })
      .filter((g): g is number => g !== undefined);
    const converted = leads.filter((l) => l.status === "converted").length;

    const summary: DashboardSummary = {
      range: { from: r.fromDay, to: r.toDay, days: r.days },
      kpis: {
        newLeads: leads.length,
        newLeadsDeltaPct: prevLeadCount === 0 ? (leads.length > 0 ? 100 : 0) : round1(((leads.length - prevLeadCount) / prevLeadCount) * 100),
        leadConversionRate: leads.length === 0 ? 0 : round1((converted / leads.length) * 100),
        enrollments: enrollCount,
        activeLearners,
        examResults: results.length,
        passRate: results.length === 0 ? 0 : round1((passed / results.length) * 100),
        avgScoreGain: gains.length === 0 ? 0 : round1(gains.reduce((a, b) => a + b, 0) / gains.length),
      },
      funnel: buildFunnel(byStage),
      leadsByDay: dailySeries(leads.map((l) => l.createdAt), r.fromMs, r.toMs),
      leadsBySource: countBy(leads, sourceOf, sourceLabel).slice(0, 6),
      recentLeads: recent.map((s) => ({ id: s.id, fullName: s.fullName ?? "(không tên)", ...(s.phone ? { phone: s.phone } : {}), formName: s.formName, createdAt: s.createdAt.toISOString(), status: s.status })),
      upcomingExams: exams.map((s) => ({
        studentId: s.id,
        studentName: s.fullName,
        studentCode: s.code,
        ...(s.profile?.targetScore ? { targetScore: s.profile.targetScore } : {}),
        ...(((s.events[0]?.data as EventData)?.examDate) ? { examDate: (s.events[0]?.data as EventData)?.examDate as string } : {}),
        stage: s.stage,
      })),
    };
    return ok(res, summary);
  }),
);

reportsRouter.get(
  "/funnel",
  authenticate,
  requirePermission("report.view"),
  handler(async (req, res) => {
    const r = resolveRange(req, 365);
    const branchId = (req.query["branchId"] as string | undefined) || undefined;
    const byStage = await studentsByStage(r.from, r.to, branchId);
    const steps = buildFunnel(byStage);
    const report: FunnelReport = { range: { from: r.fromDay, to: r.toDay }, ...(branchId ? { branchId } : {}), totalStudents: steps[0]?.count ?? 0, steps };
    return ok(res, report);
  }),
);

reportsRouter.get(
  "/funnel/export",
  authenticate,
  requirePermission("report.export"),
  handler(async (req, res) => {
    const r = resolveRange(req, 365);
    const branchId = (req.query["branchId"] as string | undefined) || undefined;
    const steps = buildFunnel(await studentsByStage(r.from, r.to, branchId));
    await writeAudit(req.auth, { action: "export", resource: "report", entityId: "funnel", entityLabel: "Xuất báo cáo phễu chuyển đổi" });
    return ok(res, steps);
  }),
);

reportsRouter.get(
  "/lead-sources",
  authenticate,
  requirePermission("report.view"),
  handler(async (req, res) => {
    const r = resolveRange(req, 90);
    const leads = await leadsIn(r.from, r.to);
    const report: LeadSourceReport = {
      range: { from: r.fromDay, to: r.toDay },
      total: leads.length,
      bySource: countBy(leads, sourceOf, sourceLabel),
      byFormType: countBy(leads, (l) => l.formType, (k) => FORM_TYPE_LABELS[k as keyof typeof FORM_TYPE_LABELS] ?? k),
      byDay: dailySeries(leads.map((l) => l.createdAt), r.fromMs, r.toMs),
    };
    return ok(res, report);
  }),
);

reportsRouter.get(
  "/enrollments",
  authenticate,
  requirePermission("report.view"),
  handler(async (req, res) => {
    const r = resolveRange(req, 365);
    const requested = req.query["groupBy"] as string | undefined;
    const groupBy: EnrollmentGroupBy = requested === "branch" || requested === "course" ? requested : "month";
    const enrolls = await stageEvents("enroll", r.from, r.to);
    const studentIds = [...new Set(enrolls.map((e) => e.studentId))];
    let rows: CountByKey[];

    if (groupBy === "month") {
      rows = countBy(enrolls, (e) => e.occurredAt.toISOString().slice(0, 7), (k) => k).sort((a, b) => a.key.localeCompare(b.key));
    } else if (groupBy === "branch") {
      const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, branchId: true, branch: { select: { name: true } } } });
      const byId = new Map(students.map((s) => [s.id, s]));
      rows = countBy(enrolls, (e) => byId.get(e.studentId)?.branchId ?? "unknown", (k) => students.find((s) => s.branchId === k)?.branch?.name ?? "Chưa gán cơ sở");
    } else {
      // Khóa học = khóa của bước đầu tiên trong lộ trình của học viên.
      const paths = await prisma.learningPath.findMany({ where: { studentId: { in: studentIds } }, orderBy: { createdAt: "asc" }, include: { steps: { orderBy: { position: "asc" }, take: 1, include: { course: { select: { id: true, name: true } } } } } });
      const courseOf = new Map<string, { id: string; name: string }>();
      for (const p of paths) if (!courseOf.has(p.studentId) && p.steps[0]?.course) courseOf.set(p.studentId, p.steps[0].course);
      rows = countBy(enrolls, (e) => courseOf.get(e.studentId)?.id ?? "unknown", (k) => [...courseOf.values()].find((c) => c.id === k)?.name ?? "Chưa xác định khóa học");
    }
    const report: EnrollmentReport = { range: { from: r.fromDay, to: r.toDay }, groupBy, total: enrolls.length, rows };
    return ok(res, report);
  }),
);

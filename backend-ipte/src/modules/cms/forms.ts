import type { Prisma } from "@prisma/client";
import { formDefinitionSchema, submissionUpdateSchema, type FormDefinitionInput, type SubmissionUpdateInput } from "../../contract/forms/schemas";
import type { FormDefinition as FormDto, FormSubmission as SubmissionDto, SubmissionSource } from "../../contract/forms/types";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, iso } from "../../core/crud/dto";
import { conflict } from "../../core/http/errors";

// ── Định nghĩa biểu mẫu ────────────────────────────────────────────────────
const include = { _count: { select: { submissions: true } } } satisfies Prisma.FormInclude;
type FormRow = Prisma.FormGetPayload<{ include: typeof include }>;

const toFormDto = (f: FormRow): FormDto =>
  compact({
    id: f.id,
    name: f.name,
    slug: f.slug,
    type: f.type,
    description: f.description ?? undefined,
    fields: f.fields as unknown as FormDto["fields"],
    submitLabel: f.submitLabel,
    successMessage: f.successMessage,
    notifyEmails: f.notifyEmails,
    status: f.status,
    submissionCount: f._count.submissions,
    createdAt: iso(f.createdAt),
    updatedAt: iso(f.updatedAt),
  });

const formData = (i: FormDefinitionInput) => ({
  name: i.name,
  slug: i.slug,
  type: i.type,
  description: i.description ?? null,
  fields: i.fields as unknown as Prisma.InputJsonValue,
  submitLabel: i.submitLabel,
  successMessage: i.successMessage,
  notifyEmails: i.notifyEmails,
  status: i.status,
});

export const formService = createCrudService<FormRow, FormDto, FormDefinitionInput>({
  resource: "form",
  label: "biểu mẫu",
  table: "forms",
  delegate: (db) => db.form,
  include,
  schema: formDefinitionSchema,
  toDtos: (rows) => rows.map(toFormDto),
  searchColumns: ["name", "slug", "description"],
  filters: { type: (v) => ({ type: v }), status: (v) => ({ status: v }) },
  sortable: { name: (d) => ({ name: d }), type: (d) => ({ type: d }), status: (d) => ({ status: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (f) => f.name,
  uniqueFields: { slug: { field: "slug", message: "Slug đã tồn tại" } },
  toCreateData: formData,
  toUpdateData: formData,
  beforeDelete: (f) => {
    if (f._count.submissions > 0) throw conflict("Biểu mẫu đã có dữ liệu gửi, hãy chuyển sang trạng thái Tạm đóng thay vì xóa");
  },
});

// ── Dữ liệu gửi (lead) ──────────────────────────────────────────────────────
const subInclude = { assignee: { select: { fullName: true } } } satisfies Prisma.FormSubmissionInclude;
type SubRow = Prisma.FormSubmissionGetPayload<{ include: typeof subInclude }>;

const toSubmissionDto = (s: SubRow): SubmissionDto =>
  compact({
    id: s.id,
    formId: s.formId,
    formName: s.formName,
    formType: s.formType,
    data: s.data as Record<string, string>,
    fullName: s.fullName ?? undefined,
    email: s.email ?? undefined,
    phone: s.phone ?? undefined,
    status: s.status,
    assignedTo: s.assignedTo ?? undefined,
    assignedToName: s.assignee?.fullName,
    notes: s.notes ?? undefined,
    source: (s.source ?? undefined) as SubmissionSource | undefined,
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
  });

const dayStart = (s: string) => new Date(`${s}T00:00:00.000Z`);
const dayEnd = (s: string) => new Date(`${s}T23:59:59.999Z`);

/** Admin chỉ xử lý lead (trạng thái, phân công, ghi chú); dữ liệu gốc khách gửi không được sửa. */
export const submissionService = createCrudService<SubRow, SubmissionDto, SubmissionUpdateInput>({
  resource: "form_submission",
  label: "dữ liệu biểu mẫu",
  table: "form_submissions",
  delegate: (db) => db.formSubmission,
  include: subInclude,
  schema: submissionUpdateSchema,
  toDtos: (rows) => rows.map(toSubmissionDto),
  searchColumns: ["full_name", "email", "phone", "form_name"],
  filters: {
    formId: (v) => ({ formId: v }),
    formType: (v) => ({ formType: v }),
    status: (v) => ({ status: v }),
    assignedTo: (v) => ({ assignedTo: v }),
    from: (v) => ({ createdAt: { gte: dayStart(v) } }),
    to: (v) => ({ createdAt: { lte: dayEnd(v) } }),
  },
  sortable: { createdAt: (d) => ({ createdAt: d }), fullName: (d) => ({ fullName: d }), status: (d) => ({ status: d }), formName: (d) => ({ formName: d }) },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (s) => `${s.formName} – ${s.fullName ?? s.phone ?? s.id}`,
  exportable: true,
  toCreateData: () => ({}),
  toUpdateData: (i) => ({ status: i.status, assignedTo: i.assignedTo ?? null, notes: i.notes ?? null }),
});

export const formsRouter = crudRouter("form", formService, { label: "biểu mẫu" });
export const submissionsRouter = crudRouter("form_submission", submissionService, { label: "dữ liệu biểu mẫu", exportable: true, only: ["list", "get", "update", "delete"] });

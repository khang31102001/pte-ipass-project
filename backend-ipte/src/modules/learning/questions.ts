import type { Prisma, Question as QuestionRow } from "@prisma/client";
import { isOptionQuestion } from "../../contract/question-bank/types";
import { questionSchema, type QuestionInput } from "../../contract/question-bank/schemas";
import type { Question as QuestionDto } from "../../contract/question-bank/types";
import type { PteTargetScore, QuestionType } from "../../contract/domain/pte";
import { nextCode } from "../../core/crud/codes";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, iso } from "../../core/crud/dto";

const toDto = (q: QuestionRow): QuestionDto =>
  compact({
    id: q.id,
    code: q.code,
    skill: q.skill,
    type: q.type as QuestionType,
    prompt: q.prompt,
    content: q.content ?? undefined,
    mediaUrl: q.mediaUrl ?? undefined,
    options: q.options as unknown as QuestionDto["options"],
    answerKey: q.answerKey ?? undefined,
    difficulty: q.difficulty,
    targetBand: (q.targetBand ?? undefined) as PteTargetScore | undefined,
    tags: q.tags,
    status: q.status,
    createdByName: q.createdByName,
    createdAt: iso(q.createdAt),
    updatedAt: iso(q.updatedAt),
  });

const fields = (i: QuestionInput) => ({
  skill: i.skill,
  type: i.type,
  prompt: i.prompt,
  content: i.content ?? null,
  mediaUrl: i.mediaUrl ?? null,
  // Chỉ dạng trắc nghiệm mới có lựa chọn.
  options: (isOptionQuestion(i.type) ? i.options : []) as unknown as Prisma.InputJsonValue,
  answerKey: i.answerKey ?? null,
  difficulty: i.difficulty,
  targetBand: i.targetBand ?? null,
  tags: i.tags,
  status: i.status,
});

export const questionService = createCrudService<QuestionRow, QuestionDto, QuestionInput>({
  resource: "question",
  label: "câu hỏi",
  table: "questions",
  delegate: (db) => db.question,
  schema: questionSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["code", "prompt", "content"],
  filters: { skill: (v) => ({ skill: v }), type: (v) => ({ type: v }), difficulty: (v) => ({ difficulty: v }), status: (v) => ({ status: v }) },
  sortable: {
    code: (d) => ({ code: d }),
    type: (d) => ({ type: d }),
    skill: (d) => ({ skill: d }),
    difficulty: (d) => ({ difficulty: d }),
    targetBand: (d) => ({ targetBand: d }),
    status: (d) => ({ status: d }),
    createdAt: (d) => ({ createdAt: d }),
    updatedAt: (d) => ({ updatedAt: d }),
  },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (q) => `${q.code} – ${q.prompt.slice(0, 50)}`,
  exportable: true,
  toCreateData: async (input, { tx, auth }) => ({ ...fields(input), code: await nextCode(tx, "question", "Q-", 4), createdByName: auth?.name ?? "Hệ thống" }),
  toUpdateData: (input) => fields(input),
});

export const questionsRouter = crudRouter("question", questionService, { label: "câu hỏi", exportable: true });

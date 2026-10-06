import { Prisma } from "@prisma/client";
import type { ZodType } from "zod";
import type { AuthContext } from "../../auth/auth.types";
import type { Resource } from "../../contract/permissions";
import { writeAudit } from "../audit/audit";
import { prisma, type Tx } from "../db/prisma";
import { conflict, notFound, badRequest, type FieldError } from "../http/errors";
import { buildMeta, type Meta } from "../http/response";
import { parseBody } from "../http/validate";
import type { ListParams } from "./list-query";
import { searchIds } from "./search";

export type Row = { id: string } & Record<string, unknown>;
type Args = Record<string, unknown>;

/** Phần của Prisma delegate mà CRUD cần (method-syntax để tương thích mọi model). */
export interface Delegate {
  findMany(args?: Args): Promise<unknown[]>;
  count(args?: Args): Promise<number>;
  findUnique(args: Args): Promise<unknown>;
  create(args: Args): Promise<unknown>;
  update(args: Args): Promise<unknown>;
  delete(args: Args): Promise<unknown>;
}

export interface WriteContext {
  auth: AuthContext | undefined;
  tx: Tx;
}

export interface CrudConfig<TRow extends Row, TDto, TInput> {
  /** Tên resource RBAC, ví dụ "student". */
  resource: Resource;
  /** Tên hiển thị trong thông báo lỗi, ví dụ "học viên". */
  label: string;
  /** Tên bảng SQL (cho tìm kiếm không dấu). */
  table: string;
  delegate(tx: Tx): Delegate;
  include?: Args;
  schema: ZodType<TInput>;
  /** Chuyển row (+ dữ liệu tổng hợp) sang DTO. Nhận cả lô để tránh N+1. */
  toDtos(rows: TRow[]): Promise<TDto[]> | TDto[];
  /** Cột SQL dùng cho `q`. */
  searchColumns?: readonly string[];
  /** Filter phẳng: tham số query → mảnh `where` của Prisma. */
  filters?: Record<string, (value: string) => Args>;
  /** sortBy hợp lệ → orderBy của Prisma. */
  sortable?: Record<string, (dir: "asc" | "desc") => Args>;
  defaultSort?: { sortBy: string; sortOrder: "asc" | "desc" };
  /** Điều kiện luôn áp dụng (ví dụ giới hạn theo cơ sở). */
  baseWhere?: (auth: AuthContext | undefined) => Args | undefined;
  entityLabel(row: TRow): string;
  /** Tạo dữ liệu Prisma từ input đã validate (có thể async: sinh mã, băm mật khẩu…). */
  toCreateData(input: TInput, ctx: WriteContext): Promise<Args> | Args;
  toUpdateData(input: TInput, current: TRow, ctx: WriteContext): Promise<Args> | Args;
  /** Chặn tạo/sửa theo nghiệp vụ/quyền chi tiết (ví dụ chỉ `approve` mới xuất bản). Ném HttpError. */
  guard?(args: { input: TInput; current?: TRow; auth: AuthContext | undefined }): void | Promise<void>;
  /** Chặn xóa (còn dữ liệu liên quan…). Ném HttpError. */
  beforeDelete?(row: TRow, ctx: WriteContext): void | Promise<void>;
  afterCreate?(row: TRow, input: TInput, ctx: WriteContext): void | Promise<void>;
  afterUpdate?(row: TRow, before: TRow, input: TInput, ctx: WriteContext): void | Promise<void>;
  afterDelete?(row: TRow, ctx: WriteContext): void | Promise<void>;
  /** Cột unique của DB → lỗi 422 theo field. */
  uniqueFields?: Record<string, FieldError>;
  /** Cho phép `/export`. */
  exportable?: boolean;
}

export interface CrudService<TDto, TInput> {
  list(params: ListParams, auth: AuthContext | undefined): Promise<{ items: TDto[]; meta: Meta }>;
  export(params: ListParams, auth: AuthContext | undefined): Promise<TDto[]>;
  get(id: string, auth?: AuthContext): Promise<TDto>;
  create(body: unknown, auth: AuthContext | undefined): Promise<TDto>;
  update(id: string, body: unknown, auth: AuthContext | undefined): Promise<TDto>;
  remove(id: string, auth: AuthContext | undefined): Promise<void>;
  parse(body: unknown): TInput;
}

/** Dịch lỗi Prisma thường gặp sang lỗi nghiệp vụ theo contract. */
export function translatePrismaError(error: unknown, cfg: { uniqueFields?: Record<string, FieldError>; label: string }, op: "write" | "delete" = "write"): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.["target"] as string[] | string | undefined) ?? [];
      const cols = Array.isArray(target) ? target : [target];
      const errors = cols.map((c) => cfg.uniqueFields?.[c]).filter((e): e is FieldError => Boolean(e));
      throw badRequest("Dữ liệu bị trùng", errors.length ? errors : [{ field: cols[0] ?? "unknown", message: "Giá trị đã tồn tại" }]);
    }
    if (error.code === "P2003" && op === "write") {
      // Tham chiếu không tồn tại (ví dụ categoryId sai) ⇒ 422 theo field (cột *_id → camelCase).
      const constraint = String(error.meta?.["field_name"] ?? "");
      const col = /_([a-z]+(?:_[a-z]+)*)_fkey/.exec(constraint)?.[1] ?? "";
      const field = col.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
      throw badRequest("Dữ liệu tham chiếu không tồn tại", [{ field: field || "reference", message: "Giá trị tham chiếu không tồn tại" }]);
    }
    if (error.code === "P2003" || error.code === "P2014") throw conflict(`Không thể thực hiện: ${cfg.label} đang được tham chiếu bởi dữ liệu khác`);
    if (error.code === "P2025") throw notFound(`Không tìm thấy ${cfg.label}`);
  }
  throw error;
}

export function createCrudService<TRow extends Row, TDto, TInput>(cfg: CrudConfig<TRow, TDto, TInput>): CrudService<TDto, TInput> {
  const find = async (db: Tx, id: string): Promise<TRow> => {
    const row = (await cfg.delegate(db).findUnique({ where: { id }, ...(cfg.include ? { include: cfg.include } : {}) })) as TRow | null;
    if (!row) throw notFound(`Không tìm thấy ${cfg.label}`);
    return row;
  };

  async function buildWhere(params: ListParams, auth: AuthContext | undefined): Promise<Args> {
    const and: Args[] = [];
    const base = cfg.baseWhere?.(auth);
    if (base) and.push(base);
    for (const [param, build] of Object.entries(cfg.filters ?? {})) {
      const value = params.raw[param];
      if (value !== undefined) and.push(build(value));
    }
    if (params.q && cfg.searchColumns?.length) and.push({ id: { in: await searchIds(cfg.table, cfg.searchColumns, params.q) } });
    return and.length ? { AND: and } : {};
  }

  const orderBy = (params: ListParams): Args[] => {
    const key = params.sortBy && cfg.sortable?.[params.sortBy] ? params.sortBy : cfg.defaultSort?.sortBy;
    if (!key || !cfg.sortable?.[key]) return [{ createdAt: "desc" }];
    const dir = params.sortBy === key ? (params.sortOrder ?? cfg.defaultSort?.sortOrder ?? "asc") : (cfg.defaultSort?.sortOrder ?? "asc");
    // Thứ tự phụ theo id để phân trang ổn định.
    return [cfg.sortable[key]!(dir), { id: "asc" }];
  };

  const run = async <T>(fn: (tx: Tx) => Promise<T>, op: "write" | "delete" = "write"): Promise<T> => {
    try {
      return await prisma.$transaction((tx) => fn(tx as Tx));
    } catch (error) {
      return translatePrismaError(error, cfg, op);
    }
  };

  return {
    parse: (body) => parseBody(cfg.schema, body),

    async list(params, auth) {
      const where = await buildWhere(params, auth);
      const d = cfg.delegate(prisma);
      const [rows, total] = await Promise.all([
        d.findMany({ where, orderBy: orderBy(params), skip: (params.page - 1) * params.pageSize, take: params.pageSize, ...(cfg.include ? { include: cfg.include } : {}) }) as Promise<TRow[]>,
        d.count({ where }),
      ]);
      return { items: await cfg.toDtos(rows), meta: buildMeta(params.page, params.pageSize, total) };
    },

    async export(params, auth) {
      const where = await buildWhere(params, auth);
      const rows = (await cfg.delegate(prisma).findMany({ where, orderBy: orderBy(params), take: 5000, ...(cfg.include ? { include: cfg.include } : {}) })) as TRow[];
      await writeAudit(auth, { action: "export", resource: cfg.resource, entityId: "-", entityLabel: `Xuất dữ liệu ${cfg.label}` });
      return cfg.toDtos(rows);
    },

    async get(id, auth) {
      const row = await find(prisma, id);
      void auth;
      return (await cfg.toDtos([row]))[0] as TDto;
    },

    async create(body, auth) {
      const input = parseBody(cfg.schema, body);
      await cfg.guard?.({ input, auth });
      const row = await run(async (tx) => {
        const ctx = { auth, tx };
        const data = await cfg.toCreateData(input, ctx);
        const created = (await cfg.delegate(tx).create({ data, ...(cfg.include ? { include: cfg.include } : {}) })) as TRow;
        await cfg.afterCreate?.(created, input, ctx);
        await writeAudit(auth, { action: "create", resource: cfg.resource, entityId: created.id, entityLabel: cfg.entityLabel(created), after: created }, tx);
        return find(tx, created.id);
      });
      return (await cfg.toDtos([row]))[0] as TDto;
    },

    async update(id, body, auth) {
      const input = parseBody(cfg.schema, body);
      const row = await run(async (tx) => {
        const current = await find(tx, id);
        await cfg.guard?.({ input, current, auth });
        const ctx = { auth, tx };
        const data = await cfg.toUpdateData(input, current, ctx);
        const updated = (await cfg.delegate(tx).update({ where: { id }, data, ...(cfg.include ? { include: cfg.include } : {}) })) as TRow;
        await cfg.afterUpdate?.(updated, current, input, ctx);
        await writeAudit(auth, { action: "update", resource: cfg.resource, entityId: id, entityLabel: cfg.entityLabel(updated), before: current, after: updated }, tx);
        return find(tx, id);
      });
      return (await cfg.toDtos([row]))[0] as TDto;
    },

    async remove(id, auth) {
      await run(async (tx) => {
        const current = await find(tx, id);
        const ctx = { auth, tx };
        await cfg.beforeDelete?.(current, ctx);
        await cfg.afterDelete?.(current, ctx);
        await cfg.delegate(tx).delete({ where: { id } });
        await writeAudit(auth, { action: "delete", resource: cfg.resource, entityId: id, entityLabel: cfg.entityLabel(current), before: current }, tx);
      }, "delete");
    },
  };
}

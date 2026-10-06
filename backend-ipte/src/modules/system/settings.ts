import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { authenticate, requirePermission } from "../../auth/middleware";
import { globalSettingsSchema, integrationSettingsSchema, notificationTemplateSchema, type NotificationTemplateInput } from "../../contract/settings/schemas";
import type { GlobalSettings, GlobalSettingsDto, IntegrationSettings, IntegrationSettingsDto, NotificationTemplate as TemplateDto } from "../../contract/settings/types";
import { writeAudit } from "../../core/audit/audit";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, iso } from "../../core/crud/dto";
import { decryptSecret, encryptSecret } from "../../core/crypto";
import { prisma } from "../../core/db/prisma";
import { handler } from "../../core/http/async";
import { ok } from "../../core/http/response";
import { parseBody } from "../../core/http/validate";

interface StoredSecrets {
  smtpPassword?: string;
  recaptchaSecret?: string;
}

const meta = (s: { updatedAt: Date; updatedByName: string | null }) => compact({ updatedAt: iso(s.updatedAt), updatedByName: s.updatedByName ?? undefined });

const load = (group: string) => prisma.setting.findUniqueOrThrow({ where: { group } });

/** Bí mật SMTP/reCAPTCHA (đã giải mã) cho dịch vụ nội bộ gửi mail/xác minh captcha — không bao giờ ra API. */
export async function getIntegrationSecrets(): Promise<{ smtpPassword?: string; recaptchaSecret?: string }> {
  const row = await prisma.setting.findUnique({ where: { group: "integration" } });
  const s = (row?.secrets ?? {}) as StoredSecrets;
  return {
    ...(s.smtpPassword ? { smtpPassword: decryptSecret(s.smtpPassword) } : {}),
    ...(s.recaptchaSecret ? { recaptchaSecret: decryptSecret(s.recaptchaSecret) } : {}),
  };
}

export async function getIntegrationSettings(): Promise<IntegrationSettings | null> {
  const row = await prisma.setting.findUnique({ where: { group: "integration" } });
  return row ? (row.value as unknown as IntegrationSettings) : null;
}

export const settingsRouter = Router();

settingsRouter.get(
  "/global",
  authenticate,
  requirePermission("setting.view"),
  handler(async (_req, res) => {
    const row = await load("global");
    return ok(res, { ...(row.value as unknown as GlobalSettings), ...meta(row) } as GlobalSettingsDto);
  }),
);

settingsRouter.put(
  "/global",
  authenticate,
  requirePermission("setting.edit"),
  handler(async (req, res) => {
    const input = parseBody(globalSettingsSchema, req.body);
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.setting.findUnique({ where: { group: "global" } });
      const after = await tx.setting.upsert({
        where: { group: "global" },
        create: { group: "global", value: input as Prisma.InputJsonValue, updatedByName: req.auth?.name ?? null },
        update: { value: input as Prisma.InputJsonValue, updatedByName: req.auth?.name ?? null },
      });
      await writeAudit(req.auth, { action: "update", resource: "setting", entityId: "global", entityLabel: "Cài đặt chung", before: before?.value, after: after.value }, tx);
      return after;
    });
    return ok(res, { ...(row.value as unknown as GlobalSettings), ...meta(row) } as GlobalSettingsDto);
  }),
);

const integrationDto = (row: Awaited<ReturnType<typeof load>>): IntegrationSettingsDto => ({ ...(row.value as unknown as IntegrationSettings), ...meta(row) });

settingsRouter.get(
  "/integration",
  authenticate,
  requirePermission("setting.view"),
  handler(async (_req, res) => ok(res, integrationDto(await load("integration")))),
);

/** Bí mật chỉ ghi: để trống = giữ nguyên; lưu mã hóa AES-GCM; GET chỉ trả hasPassword/hasSecret. */
settingsRouter.put(
  "/integration",
  authenticate,
  requirePermission("setting.edit"),
  handler(async (req, res) => {
    const input = parseBody(integrationSettingsSchema, req.body);
    const row = await prisma.$transaction(async (tx) => {
      const prev = await tx.setting.findUnique({ where: { group: "integration" } });
      const secrets: StoredSecrets = { ...((prev?.secrets ?? {}) as StoredSecrets) };
      const { password, ...smtp } = input.smtp;
      const { secret, ...recaptcha } = input.recaptcha;
      if (password) secrets.smtpPassword = encryptSecret(password);
      if (secret) secrets.recaptchaSecret = encryptSecret(secret);
      const value: IntegrationSettings = {
        smtp: { ...smtp, hasPassword: Boolean(secrets.smtpPassword) },
        recaptcha: { ...recaptcha, hasSecret: Boolean(secrets.recaptchaSecret) },
        crm: input.crm as IntegrationSettings["crm"],
        storage: input.storage,
      };
      const after = await tx.setting.upsert({
        where: { group: "integration" },
        create: { group: "integration", value: value as unknown as Prisma.InputJsonValue, secrets: secrets as Prisma.InputJsonValue, updatedByName: req.auth?.name ?? null },
        update: { value: value as unknown as Prisma.InputJsonValue, secrets: secrets as Prisma.InputJsonValue, updatedByName: req.auth?.name ?? null },
      });
      await writeAudit(req.auth, { action: "update", resource: "setting", entityId: "integration", entityLabel: "Cài đặt tích hợp", before: prev?.value, after: after.value }, tx);
      return after;
    });
    return ok(res, integrationDto(row));
  }),
);

// ── Mẫu thông báo ──────────────────────────────────────────────────────────
type TemplateRow = Prisma.NotificationTemplateGetPayload<object>;

const toDto = (t: TemplateRow): TemplateDto =>
  compact({ id: t.id, key: t.key, name: t.name, channel: t.channel, subject: t.subject ?? undefined, body: t.body, variables: t.variables, isActive: t.isActive, createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt) });

const data = (i: NotificationTemplateInput) => ({ key: i.key, name: i.name, channel: i.channel, subject: i.subject ?? null, body: i.body, variables: i.variables, isActive: i.isActive });

export const templateService = createCrudService<TemplateRow, TemplateDto, NotificationTemplateInput>({
  resource: "notification_template",
  label: "mẫu thông báo",
  table: "notification_templates",
  delegate: (db) => db.notificationTemplate,
  schema: notificationTemplateSchema,
  toDtos: (rows) => rows.map(toDto),
  searchColumns: ["name", "key", "body"],
  filters: { channel: (v) => ({ channel: v }), isActive: (v) => ({ isActive: v === "true" }) },
  sortable: { name: (d) => ({ name: d }), key: (d) => ({ key: d }), channel: (d) => ({ channel: d }), updatedAt: (d) => ({ updatedAt: d }) },
  defaultSort: { sortBy: "name", sortOrder: "asc" },
  entityLabel: (t) => t.name,
  uniqueFields: { key: { field: "key", message: "Định danh đã tồn tại" } },
  toCreateData: data,
  toUpdateData: data,
});

export const templatesRouter = crudRouter("notification_template", templateService, { label: "mẫu thông báo" });

import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { authenticate, requirePermission } from "../../auth/middleware";
import { siteConfigSchema } from "../../contract/site-config/schemas";
import type { SiteConfig } from "../../contract/site-config/types";
import { writeAudit } from "../../core/audit/audit";
import { iso } from "../../core/crud/dto";
import { prisma } from "../../core/db/prisma";
import { handler } from "../../core/http/async";
import { ok } from "../../core/http/response";
import { parseBody } from "../../core/http/validate";
import { revalidateWebsite } from "./integrations";

type Row = Prisma.SiteConfigGetPayload<object>;

export const toSiteConfig = (r: Row): SiteConfig => ({
  updatedAt: iso(r.updatedAt),
  ...(r.updatedByName ? { updatedByName: r.updatedByName } : {}),
  general: r.general as unknown as SiteConfig["general"],
  contact: r.contact as unknown as SiteConfig["contact"],
  social: r.social as unknown as SiteConfig["social"],
  policies: r.policies as unknown as SiteConfig["policies"],
  chat: r.chat as unknown as SiteConfig["chat"],
  tracking: r.tracking as unknown as SiteConfig["tracking"],
});

export const loadSiteConfig = () => prisma.siteConfig.findUniqueOrThrow({ where: { id: "site" } });

/** Cấu hình website (singleton). Widget chat chỉ là tích hợp bên thứ ba. */
export const siteConfigRouter = Router();

siteConfigRouter.get(
  "/",
  authenticate,
  requirePermission("site_config.view"),
  handler(async (_req, res) => ok(res, toSiteConfig(await loadSiteConfig()))),
);

siteConfigRouter.put(
  "/",
  authenticate,
  requirePermission("site_config.edit"),
  handler(async (req, res) => {
    const input = parseBody(siteConfigSchema, req.body);
    const data = {
      general: input.general as unknown as Prisma.InputJsonValue,
      contact: input.contact as unknown as Prisma.InputJsonValue,
      social: input.social as unknown as Prisma.InputJsonValue,
      policies: input.policies as unknown as Prisma.InputJsonValue,
      chat: input.chat as unknown as Prisma.InputJsonValue,
      tracking: input.tracking as unknown as Prisma.InputJsonValue,
      updatedByName: req.auth?.name ?? null,
    };
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.siteConfig.findUnique({ where: { id: "site" } });
      const after = await tx.siteConfig.upsert({ where: { id: "site" }, create: { id: "site", ...data }, update: data });
      await writeAudit(req.auth, { action: "update", resource: "site_config", entityId: "site-config", entityLabel: "Cấu hình website", before: before && toSiteConfig(before), after: toSiteConfig(after) }, tx);
      return after;
    });
    void revalidateWebsite(["site-config"]);
    return ok(res, toSiteConfig(row));
  }),
);

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/** PrismaClient dùng chung (tránh tạo nhiều kết nối khi hot-reload). */
export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient({ log: ["warn"] });
if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** Làm sạch DB test (TRUNCATE) rồi seed nền tảng — mỗi lần chạy bắt đầu từ trạng thái sạch. */
export default async function setup() {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) throw new Error("Thiếu TEST_DATABASE_URL");
  process.env["DATABASE_URL"] = url;
  const prisma = new PrismaClient({ datasourceUrl: url });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await prisma.$disconnect();
  process.env["SEED_ADMIN_EMAIL"] = "";
  const { execSync } = await import("node:child_process");
  execSync("npx tsx prisma/seed.ts", { env: { ...process.env, DATABASE_URL: url, SEED_ADMIN_EMAIL: "", SEED_ADMIN_PASSWORD: "" }, stdio: "ignore" });
}

/**
 * Tách ảnh base64 nhúng trong mô tả khóa học ra tệp ở storage/legacy/ và thay bằng URL.
 * Idempotent (chạy lại không đổi gì khi không còn base64). Dùng: npx tsx scripts/extract-course-images.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";
import { prisma } from "../src/core/db/prisma";
import { env } from "../src/config/env";

const STORAGE_DIR = join(process.cwd(), env.UPLOAD_DIR, "legacy");
const PUBLIC_BASE = env.PUBLIC_BASE_URL.replace(/\/+$/, "");

function extract(html: string, key: string): string {
  return html.replace(/src="data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=\s]+)"/g, (_m, ext: string, b64: string) => {
    const buf = Buffer.from(b64.replace(/\s/g, ""), "base64");
    const name = `${key}-${createHash("sha1").update(buf).digest("hex").slice(0, 12)}.${ext === "jpeg" ? "jpg" : ext}`;
    mkdirSync(STORAGE_DIR, { recursive: true });
    writeFileSync(join(STORAGE_DIR, name), buf);
    return `src="${PUBLIC_BASE}/storage/legacy/${name}"`;
  });
}

async function main() {
  const courses = await prisma.course.findMany({ select: { id: true, slug: true, description: true, summary: true } });
  for (const c of courses) {
    const description = extract(c.description ?? "", `course-${c.slug}`);
    const summary = extract(c.summary ?? "", `course-${c.slug}`);
    if (description !== (c.description ?? "") || summary !== (c.summary ?? "")) {
      await prisma.course.update({ where: { id: c.id }, data: { description, summary } });
      console.log(`${c.slug}: ${(c.description ?? "").length} → ${description.length} ký tự`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

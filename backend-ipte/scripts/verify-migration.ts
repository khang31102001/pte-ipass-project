/** Đối soát sau migrate: số lượng legacy vs mới, FK mồ côi, trùng lặp, dữ liệu nghiệp vụ. Không ghi gì. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";

const prisma = new PrismaClient();
(async () => {
  const legacy = new Client({ connectionString: process.env["LEGACY_DATABASE_URL"] });
  await legacy.connect();
  const count = async (sql: string) => Number((await legacy.query(sql)).rows[0].n);
  const rows: [string, number, number, string][] = [];
  const add = async (name: string, legacySql: string, now: Promise<number>, note = "") => rows.push([name, await count(legacySql), await now, note]);

  await add("users", `select count(*) n from "user"`, prisma.legacyMap.count({ where: { source: "user" } }));
  await add("teachers", `select count(*) n from teacher`, prisma.legacyMap.count({ where: { source: "teacher" } }));
  await add("courses", `select count(*) n from course`, prisma.legacyMap.count({ where: { source: "course" } }));
  await add("news→articles", `select count(*) n from news`, prisma.legacyMap.count({ where: { source: "news" } }));
  await add("consultation→submissions", `select count(*) n from consultation`, prisma.legacyMap.count({ where: { source: "consultation" } }));
  await add("banner (4/10 có vị trí)", `select count(*) n from banner where placement in ('BANNER_HOME','BANNER_COURSES','BANNER_NEWS','BANNER_STUDNET_REVIEW')`, prisma.legacyMap.count({ where: { source: "banner" } }));
  await add("media (8/10 nghiệp vụ)", `select count(*) n from media where trim(category_type) in ('STUDENT_TESTIMONIALS','FEATURED_STUDENT_STORY','STUDENT_STORY','ABOUT_FACILITIES')`, prisma.legacyMap.count({ where: { source: "media" } }));
  await add("branches", `select count(*) n from information where category_type='CONTACT_BRANCH_ITEM'`, prisma.legacyMap.count({ where: { targetTable: "branches" } }));

  console.log("Nguồn (legacy)  Đích (mới)  Kết quả");
  let ok = true;
  for (const [name, a, b] of rows) {
    const pass = a === b;
    ok &&= pass;
    console.log(`${name.padEnd(30)} ${String(a).padStart(3)} ${String(b).padStart(3)}  ${pass ? "OK" : "LỆCH"}`);
  }

  const checks: [string, number][] = [
    ["khóa học không có danh mục", (await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM courses c LEFT JOIN course_categories k ON k.id=c.category_id WHERE k.id IS NULL`)[0]?.n as unknown as number],
    ["slug bài viết trùng", (await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM (SELECT slug FROM articles GROUP BY slug HAVING count(*)>1) t`)[0]?.n as unknown as number],
    ["slug khóa học trùng", (await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM (SELECT slug FROM courses GROUP BY slug HAVING count(*)>1) t`)[0]?.n as unknown as number],
    ["submission thiếu form", (await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM form_submissions s LEFT JOIN forms f ON f.id=s.form_id WHERE f.id IS NULL`)[0]?.n as unknown as number],
    ["bài viết còn base64 nhúng", await prisma.article.count({ where: { content: { contains: "data:image" } } })],
    ["user chưa bắt đổi mật khẩu (legacy)", await prisma.user.count({ where: { id: { in: (await prisma.legacyMap.findMany({ where: { targetTable: "users" } })).map((m) => m.targetId) }, mustChangePassword: false } })],
  ];
  console.log("\nToàn vẹn:");
  for (const [name, n] of checks) {
    const pass = Number(n) === 0;
    ok &&= pass;
    console.log(`${name.padEnd(36)} ${String(Number(n)).padStart(3)}  ${pass ? "OK" : "CẦN XEM"}`);
  }
  const arts = await prisma.article.findMany({ select: { slug: true, status: true } });
  console.log("\nBài viết:", arts.map((a) => `${a.slug}:${a.status}`).join(", "));
  console.log(ok ? "\nVERIFY: PASS" : "\nVERIFY: CÓ LỆCH");
  await legacy.end();
  await prisma.$disconnect();
})();

/**
 * Migrate dữ liệu từ database legacy (ipte) sang schema mới (ipte_v2).
 *
 * Quy trình: Extract (đọc-only) → Transform → Validate → Load (1 transaction) → Verify → Report.
 *  - Mặc định chạy DRY-RUN (không ghi). Thêm `--apply` để ghi.
 *  - Idempotent: bảng legacy_map ghi (source, sourceId) → bản ghi mới; chạy lại không tạo trùng.
 *  - KHÔNG chạm DB legacy (kết nối READ ONLY) và KHÔNG xóa gì.
 *  - Rollback: `--rollback` xóa các bản ghi đã tạo theo legacy_map (không đụng dữ liệu tạo mới sau đó).
 *
 * Yêu cầu: LEGACY_DATABASE_URL, DATABASE_URL (không ghi credential vào log/báo cáo).
 * Ánh xạ chi tiết: docs/migration.md.
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { hashPassword } from "../src/auth/password";
import { slugify } from "../src/core/crud/codes";

const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");
const prisma = new PrismaClient();
const STORAGE_DIR = resolve(process.env["UPLOAD_DIR"] ?? "storage", "legacy");
const PUBLIC_BASE = (process.env["PUBLIC_BASE_URL"] ?? "http://localhost:4000").replace(/\/+$/, "");

type Row = Record<string, unknown>;
interface StepReport {
  step: string;
  legacyCount: number;
  migrated: number;
  skipped: number;
  notes: string[];
}
const report: StepReport[] = [];
const issues: string[] = [];

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v)).trim();
const num = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};
const date = (v: unknown): Date | null => (v instanceof Date ? v : v ? new Date(String(v)) : null);

async function main() {
  const legacyUrl = process.env["LEGACY_DATABASE_URL"];
  if (!legacyUrl) throw new Error("Thiếu LEGACY_DATABASE_URL");
  if (legacyUrl === process.env["DATABASE_URL"]) throw new Error("LEGACY_DATABASE_URL trùng DATABASE_URL — dừng để tránh ghi nhầm vào DB cũ");

  if (ROLLBACK) return rollback();

  const legacy = new Client({ connectionString: legacyUrl });
  await legacy.connect();
  await legacy.query("SET default_transaction_read_only = on");
  const q = async (sql: string): Promise<Row[]> => (await legacy.query(sql)).rows as Row[];

  // ── EXTRACT ──────────────────────────────────────────────────────────────
  const data = {
    users: await q(`SELECT u.*, (SELECT string_agg(r.role_name, ',') FROM user_role ur JOIN role r ON r.role_id = ur.role_id WHERE ur.user_id = u.user_id) AS roles FROM "user" u ORDER BY user_id`),
    courses: await q(`SELECT * FROM course ORDER BY course_id`),
    teachers: await q(`SELECT * FROM teacher ORDER BY teacher_id`),
    news: await q(`SELECT * FROM news ORDER BY news_id`),
    consultations: await q(`SELECT * FROM consultation ORDER BY consultation_id`),
    banners: await q(`SELECT * FROM banner ORDER BY banner_id`),
    media: await q(`SELECT * FROM media ORDER BY media_id`),
    information: await q(`SELECT * FROM information ORDER BY information_id`),
    categories: await q(`SELECT category_id, parent_id, category_type, name, description FROM category`),
  };

  const mapped = new Set((await prisma.legacyMap.findMany({ select: { source: true, sourceId: true } })).map((m) => `${m.source}:${m.sourceId}`));
  const isMapped = (source: string, id: unknown) => mapped.has(`${source}:${id}`);
  const plan: (() => Promise<void>)[] = [];
  const ids = new Map<string, string>(); // `${source}:${legacyId}` → target id (cả đã migrate trước đó)
  for (const m of await prisma.legacyMap.findMany()) ids.set(`${m.source}:${m.sourceId}`, m.targetId);

  const remember = async (tx: Prisma.TransactionClient, source: string, sourceId: unknown, targetTable: string, targetId: string) => {
    await tx.legacyMap.upsert({ where: { source_sourceId: { source, sourceId: String(sourceId) } }, create: { source, sourceId: String(sourceId), targetTable, targetId }, update: { targetId, targetTable } });
    ids.set(`${source}:${sourceId}`, targetId);
  };
  const step = (name: string, legacyCount: number, fn: (tx: Prisma.TransactionClient, rep: StepReport) => Promise<void>) =>
    plan.push(async () => {
      const rep: StepReport = { step: name, legacyCount, migrated: 0, skipped: 0, notes: [] };
      report.push(rep);
      await tx_(fn, rep);
    });
  let currentTx: Prisma.TransactionClient | null = null;
  const tx_ = async (fn: (tx: Prisma.TransactionClient, rep: StepReport) => Promise<void>, rep: StepReport) => {
    if (!currentTx) throw new Error("no tx");
    await fn(currentTx, rep);
  };

  // ── 1. USERS ─────────────────────────────────────────────────────────────
  step("users → users", data.users.length, async (tx, rep) => {
    const adminRole = await tx.role.findUniqueOrThrow({ where: { name: "Admin" } });
    for (const u of data.users) {
      if (isMapped("user", u["user_id"])) {
        rep.skipped++;
        continue;
      }
      const email = str(u["email"]).toLowerCase();
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        await remember(tx, "user", u["user_id"], "users", existing.id);
        rep.skipped++;
        rep.notes.push(`email trùng với tài khoản mới, ánh xạ vào tài khoản có sẵn (legacy #${u["user_id"]})`);
        continue;
      }
      const isAdmin = str(u["roles"]).split(",").includes("ADMIN");
      // Không migrate mật khẩu bcrypt cũ: đặt mật khẩu ngẫu nhiên không dùng được + bắt buộc đổi; Admin cấp lại bằng "reset-password".
      const created = await tx.user.create({
        data: {
          email,
          fullName: str(u["full_name"]) || str(u["username"]),
          roleId: adminRole.id,
          status: u["is_active"] === false ? "inactive" : "active",
          avatarUrl: null,
          passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
          mustChangePassword: true,
          createdAt: date(u["created_at"]) ?? new Date(),
        },
      });
      await remember(tx, "user", u["user_id"], "users", created.id);
      rep.migrated++;
      if (!isAdmin) rep.notes.push(`legacy user #${u["user_id"]} không có vai trò ADMIN → gán Admin (vai trò USER cũ không còn)`);
    }
    rep.notes.push("Mật khẩu KHÔNG được chuyển (băm bcrypt khác thuật toán): cần Admin cấp lại qua POST /users/:id/reset-password");
  });

  // ── 2. TEACHERS ──────────────────────────────────────────────────────────
  step("teacher → teachers", data.teachers.length, async (tx, rep) => {
    for (const t of data.teachers) {
      if (isMapped("teacher", t["teacher_id"])) {
        rep.skipped++;
        continue;
      }
      const slug = slugify(str(t["slug"]) || str(t["name"])) || `giao-vien-${t["teacher_id"]}`;
      const count = await tx.counter.upsert({ where: { name: "teacher" }, create: { name: "teacher", value: 1 }, update: { value: { increment: 1 } } });
      const scores = ["overall", "listening", "speaking", "reading", "writing"].map((k) => `${k[0]?.toUpperCase()}${k.slice(1)} ${num(t[`${k}_score`]) ?? "-"}`).join(", ");
      const created = await tx.teacher.create({
        data: {
          code: `GV-${String(count.value).padStart(3, "0")}`,
          slug,
          fullName: str(t["name"]),
          // Legacy không có email: dùng địa chỉ giữ chỗ (.invalid theo RFC 2606) để Admin cập nhật.
          email: `${slug}@giao-vien.pteipass.invalid`,
          avatarUrl: str(t["image"]) || null,
          bio: str(t["bio"]) || null,
          // Điểm legacy theo thang 0–10 (kiểu IELTS) ≠ PTE 10–90 ⇒ không quy đổi; giữ nguyên trong chứng chỉ để Admin nhập điểm PTE.
          pteScore: null,
          qualifications: [`Điểm legacy (thang 0–10): ${scores}`],
          specialties: [],
          status: "active",
          createdAt: date(t["created_at"]) ?? new Date(),
        },
      });
      await remember(tx, "teacher", t["teacher_id"], "teachers", created.id);
      rep.migrated++;
    }
    rep.notes.push("email giữ chỗ *.pteipass.invalid và điểm 0–10 không quy đổi sang PTE: cần cập nhật thủ công");
  });

  // ── 3. COURSES ───────────────────────────────────────────────────────────
  step("course → courses", data.courses.length, async (tx, rep) => {
    const cats = await tx.courseCategory.findMany();
    const catBySlug = (s: string) => cats.find((c) => c.slug === s)?.id;
    for (const c of data.courses) {
      if (isMapped("course", c["course_id"])) {
        rep.skipped++;
        continue;
      }
      const name = str(c["course_name"]) || str(c["title"]);
      const range = /(\d{2,3})\s*[-–]\s*(\d{2,3})/.exec(name);
      const targetScore = range ? Number(range[2]) : null;
      const validTargets = [30, 36, 42, 50, 58, 65, 79];
      const target = targetScore && validTargets.includes(targetScore) ? targetScore : null;
      const type = target ? "target_score" : "preparation";
      const categoryId =
        (target === null ? catBySlug("pte-nen-tang-pre-pte") : target <= 42 ? catBySlug("pte-30-42") : target <= 58 ? catBySlug("pte-50-58") : catBySlug("pte-65-79")) ?? cats[0]?.id;
      if (!categoryId) throw new Error("Chưa có danh mục khóa học: chạy `npm run db:seed` trước");

      const weeks = num(/\d+/.exec(str(c["duration"]))?.[0]) ?? 4;
      const text = `${str(c["description"])} ${str(c["content"])}`;
      const sessions = num(/(\d+)\s*buổi/i.exec(text)?.[1]) ?? weeks * 3;
      const rawTuition = num(c["tuition"]);
      // 999999 là giá trị giữ chỗ trong dữ liệu cũ ⇒ coi là "liên hệ tư vấn" (0).
      const tuition = rawTuition === null || rawTuition >= 999_999 ? 0 : rawTuition;
      const level = str(c["level"]);
      const description = [str(c["content"]), str(c["benefits"])].filter(Boolean).join("\n");
      const created = await tx.course.create({
        data: {
          code: str(c["course_code"]) || `KH-${String(c["course_id"]).padStart(3, "0")}`,
          name,
          slug: slugify(str(c["slug"]) || name),
          categoryId,
          type,
          targetScore: target,
          entryLevel: level === "ADVANCED" ? "58" : level === "INTERMEDIATE" ? "42" : "none",
          mode: str(c["mode"]) === "OFFLINE" ? "offline" : str(c["mode"]) === "HYBRID" ? "hybrid" : "online",
          durationWeeks: weeks,
          sessionsCount: sessions,
          tuition,
          summary: str(c["description"]).slice(0, 300) || name,
          description: description || null,
          outcomes: [],
          audience: Array.isArray(c["audience"]) ? (c["audience"] as string[]) : [],
          status: c["is_disabled"] === true ? "archived" : "published",
          isFeatured: c["is_featured"] === true,
          thumbnailUrl: str(c["image"]) || null,
          metaTitle: str(c["meta_title"]) || null,
          metaDescription: str(c["meta_description"]) || null,
          createdAt: date(c["created_at"]) ?? new Date(),
        },
      });
      await remember(tx, "course", c["course_id"], "courses", created.id);
      rep.migrated++;
      if (rawTuition !== null && rawTuition >= 999_999) rep.notes.push(`course #${c["course_id"]}: học phí 999999 (giá trị giữ chỗ) → 0 = liên hệ tư vấn`);
    }
    rep.notes.push("sessionsCount suy ra từ mô tả (\"N buổi\") hoặc = số tuần × 3 khi không có; outcomes/giáo viên phụ trách để trống");
  });

  // ── 4. NEWS → ARTICLES ───────────────────────────────────────────────────
  const extractImages = (html: string, key: string): string =>
    html.replace(/src="data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=\s]+)"/g, (_m, ext: string, b64: string) => {
      const buf = Buffer.from(b64.replace(/\s/g, ""), "base64");
      const name = `${key}-${createHash("sha1").update(buf).digest("hex").slice(0, 12)}.${ext === "jpeg" ? "jpg" : ext}`;
      if (APPLY) {
        mkdirSync(STORAGE_DIR, { recursive: true });
        writeFileSync(join(STORAGE_DIR, name), buf);
      }
      return `src="${PUBLIC_BASE}/storage/legacy/${name}"`;
    });

  step("news → articles (+tags)", data.news.length, async (tx, rep) => {
    const category = await tx.articleCategory.findUniqueOrThrow({ where: { slug: "tin-tuc-su-kien" } });
    const seen = new Map<string, string>();
    for (const n of data.news) {
      if (isMapped("news", n["news_id"])) {
        rep.skipped++;
        continue;
      }
      const html = extractImages(str(n["content"]), `news-${n["news_id"]}`);
      const fingerprint = createHash("sha1").update(`${str(n["title"])}|${str(n["content"])}`).digest("hex"); // trên nội dung gốc (trước khi tách ảnh)
      const duplicateOf = seen.get(fingerprint);
      seen.set(fingerprint, seen.get(fingerprint) ?? String(n["news_id"]));

      let status = str(n["status"]) === "DRAFT" ? "draft" : str(n["status"]) === "ARCHIVED" ? "archived" : "published";
      if (duplicateOf) {
        // Bản sao y hệt bài đã có: lưu trữ để không hiển thị trùng trên website (không xóa dữ liệu).
        status = "archived";
        rep.notes.push(`news #${n["news_id"]} trùng nội dung với #${duplicateOf} → archived`);
      }
      const author = ids.get(`user:${n["author_id"]}`);
      const tagNames = (Array.isArray(n["tags"]) ? (n["tags"] as string[]) : []).map(str).filter((t) => t && t.toUpperCase() !== "TAGS");
      const created = await tx.article.create({
        data: {
          title: str(n["title"]),
          slug: slugify(str(n["slug"]) || str(n["title"])),
          excerpt: str(n["description"]).slice(0, 320) || str(n["title"]),
          content: html || "<p></p>",
          coverUrl: str(n["image"]) || null,
          categoryId: category.id,
          authorId: author ?? null,
          isFeatured: n["is_featured"] === true && !duplicateOf,
          status: status as "draft" | "published" | "archived",
          publishedAt: status === "published" ? (date(n["published_at"]) ?? date(n["created_at"]) ?? new Date()) : null,
          metaTitle: str(n["meta_title"]) || null,
          metaDescription: str(n["meta_description"]) || null,
          readingMinutes: Math.max(1, Math.round(html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200)),
          createdAt: date(n["created_at"]) ?? new Date(),
          tags: {
            create: await Promise.all(
              tagNames.map(async (name) => {
                const slug = slugify(name);
                const tag = await tx.tag.upsert({ where: { slug }, create: { name, slug }, update: {} });
                return { tag: { connect: { id: tag.id } } };
              }),
            ),
          },
        },
      });
      await remember(tx, "news", n["news_id"], "articles", created.id);
      rep.migrated++;
    }
    rep.notes.push("Ảnh base64 nhúng trong nội dung được tách ra tệp tại storage/legacy/ và thay bằng URL; tag giữ chỗ \"TAGS\" bị bỏ");
  });

  // ── 5. CONSULTATION → FORM SUBMISSIONS ───────────────────────────────────
  step("consultation → form_submissions", data.consultations.length, async (tx, rep) => {
    const form = await tx.form.findUniqueOrThrow({ where: { slug: "dang-ky-tu-van" } });
    const SCORE: Record<string, string> = { "30-35": "PTE 30", "36-41": "PTE 36", "42-49": "PTE 42", "50-59": "PTE 50", "65-79": "PTE 65", "79+": "PTE 79" };
    for (const c of data.consultations) {
      if (isMapped("consultation", c["consultation_id"])) {
        rep.skipped++;
        continue;
      }
      const target = SCORE[str(c["target_score"])] ?? str(c["target_score"]);
      const payload: Record<string, string> = { fullName: str(c["name"]), phone: str(c["phone"]), email: str(c["email"]), message: str(c["message"]) };
      if (target) payload["targetScore"] = target;
      for (const k of Object.keys(payload)) if (!payload[k]) delete payload[k];
      const created = await tx.formSubmission.create({
        data: {
          formId: form.id,
          formName: form.name,
          formType: form.type,
          data: payload,
          fullName: payload["fullName"] ?? null,
          email: payload["email"]?.toLowerCase() ?? null,
          phone: payload["phone"] ?? null,
          status: str(c["status"]) === "NEW" ? "new" : "contacted",
          source: { landingPage: "(legacy)" },
          createdAt: date(c["created_at"]) ?? new Date(),
        },
      });
      await remember(tx, "consultation", c["consultation_id"], "form_submissions", created.id);
      rep.migrated++;
    }
    rep.notes.push("Trạng thái READ → contacted; điểm mục tiêu dạng khoảng được quy về mốc PTE gần nhất");
  });

  // ── 6. BANNERS ───────────────────────────────────────────────────────────
  step("banner → banners", data.banners.length, async (tx, rep) => {
    const PLACEMENT: Record<string, "home_hero" | "courses" | "news" | "home_secondary"> = {
      BANNER_HOME: "home_hero",
      BANNER_COURSES: "courses",
      BANNER_NEWS: "news",
      BANNER_STUDNET_REVIEW: "home_secondary",
    };
    for (const b of data.banners) {
      if (isMapped("banner", b["banner_id"])) {
        rep.skipped++;
        continue;
      }
      const placement = PLACEMENT[str(b["placement"])];
      if (!placement) {
        rep.skipped++;
        rep.notes.push(`banner #${b["banner_id"]} (${str(b["placement"])}) không có vị trí tương ứng trong mô hình mới → giữ ở DB cũ, không migrate`);
        continue;
      }
      const created = await tx.banner.create({
        data: { title: str(b["title"]), placement, imageUrl: str(b["image"]), linkUrl: str(b["action_url"]) || null, altText: str(b["title"]), startAt: date(b["start_date"]), endAt: date(b["end_date"]), status: b["is_active"] === false ? "inactive" : "active", sortOrder: num(b["order"]) ?? 0, createdAt: date(b["created_at"]) ?? new Date() },
      });
      await remember(tx, "banner", b["banner_id"], "banners", created.id);
      rep.migrated++;
    }
  });

  // ── 7. MEDIA → TESTIMONIALS / MEDIA ──────────────────────────────────────
  step("media → testimonials, media_items", data.media.length, async (tx, rep) => {
    const TESTIMONIAL = new Set(["STUDENT_TESTIMONIALS", "FEATURED_STUDENT_STORY", "STUDENT_STORY"]);
    let order = 0;
    for (const m of data.media) {
      if (isMapped("media", m["media_id"])) {
        rep.skipped++;
        continue;
      }
      const type = str(m["category_type"]).trim();
      if (TESTIMONIAL.has(type)) {
        order += 1;
        // Legacy không có điểm số: đặt 0 + trạng thái nháp ⇒ không hiển thị công khai cho tới khi Admin nhập điểm thật.
        const created = await tx.testimonial.create({
          data: {
            studentName: str(m["title"]) || "Học viên",
            headline: type === "FEATURED_STUDENT_STORY" ? "Câu chuyện thành công nổi bật" : "Cảm nhận học viên",
            quote: str(m["description"]) || str(m["title"]),
            avatarUrl: str(m["image_url"]) || null,
            scoreAfter: 0,
            rating: 5,
            videoUrl: str(m["video_url"]) || null,
            isFeatured: type !== "STUDENT_TESTIMONIALS",
            status: "draft",
            sortOrder: order,
            createdAt: date(m["created_at"]) ?? new Date(),
          },
        });
        await remember(tx, "media", m["media_id"], "testimonials", created.id);
        rep.migrated++;
      } else if (type === "ABOUT_FACILITIES") {
        const created = await tx.mediaItem.create({ data: { name: str(m["title"]) || "Cơ sở vật chất", kind: "image", url: str(m["image_url"]), altText: str(m["description"]) || null, folder: "facilities", tags: ["facilities"], createdAt: date(m["created_at"]) ?? new Date() } });
        await remember(tx, "media", m["media_id"], "media_items", created.id);
        rep.migrated++;
      } else {
        rep.skipped++;
        rep.notes.push(`media #${m["media_id"]} (${type}) là liên kết mạng xã hội/khối giao diện → thay bằng site-config.social, không migrate`);
      }
    }
    rep.notes.push("Cảm nhận migrate ở trạng thái draft với scoreAfter=0 (thiếu điểm trong dữ liệu cũ): Admin cần bổ sung điểm rồi xuất bản");
  });

  // ── 8. INFORMATION → BRANCHES + SITE CONFIG ──────────────────────────────
  step("information → branches, site_config", data.information.length, async (tx, rep) => {
    const social: Record<string, string> = {};
    let hotline = "";
    let email = "";
    let firstAddress = "";
    let order = 0;
    for (const i of data.information) {
      const type = str(i["category_type"]);
      if (type.startsWith("CONTACT_COMMUNITY_LINK_")) {
        const url = str(i["social_url"]);
        if (type.endsWith("FACEBOOK")) social["facebook"] = url;
        else if (type.endsWith("TIKTOK")) social["tiktok"] = url;
        else if (type.endsWith("YOUTUBE")) social["youtube"] = url;
        else if (type.endsWith("ZALO")) social["zaloOa"] = url;
      } else if (type === "CONTACT_BRANCH_ITEM") {
        hotline ||= str(i["hotline"]);
        email ||= str(i["email"]);
        firstAddress ||= str(i["address"]);
        if (isMapped("information", i["information_id"])) {
          rep.skipped++;
          continue;
        }
        order += 1;
        const address = str(i["address"]);
        const label = /^(.*?):\s*(.*)$/.exec(address);
        const created = await tx.branch.create({
          data: {
            code: `CS-${String(order).padStart(2, "0")}`,
            name: str(i["title"]).split(":")[0]?.trim() || `Cơ sở ${order}`,
            country: "VN",
            city: "TP. Hồ Chí Minh",
            address: label?.[2] ?? address,
            phone: str(i["phone"]) || str(i["hotline"]) || "—",
            email: str(i["email"]) || null,
            mapUrl: str(i["map_url"]) || null,
            status: "active",
            createdAt: date(i["created_at"]) ?? new Date(),
          },
        });
        await remember(tx, "information", i["information_id"], "branches", created.id);
        rep.migrated++;
      }
    }
    const config = await tx.siteConfig.findUniqueOrThrow({ where: { id: "site" } });
    const contact = { ...(config.contact as Record<string, unknown>) };
    const sc = { ...(config.social as Record<string, unknown>), ...social };
    if (hotline) contact["hotlineVN"] = hotline;
    if (email) contact["email"] = email;
    if (firstAddress) contact["address"] = firstAddress;
    const zalo = /zalo\.me\/(\d+)/.exec(social["zaloOa"] ?? "")?.[1];
    if (zalo) contact["zalo"] = zalo;
    await tx.siteConfig.update({ where: { id: "site" }, data: { contact: contact as Prisma.InputJsonValue, social: sc as Prisma.InputJsonValue, updatedByName: "Migration" } });
    rep.notes.push(`site_config: cập nhật hotline/email/địa chỉ/Zalo và ${Object.keys(social).length} liên kết mạng xã hội từ bảng information`);
  });

  // ── 9. NỘI DUNG TRANG (category + information ABOUT) → CMS pages ─────────
  step("category/information → pages (nội dung trang)", data.categories.length, async (tx, rep) => {
    const byType = (t: string) => data.categories.filter((c) => str(c["category_type"]) === t);
    const faqs = data.categories
      .filter((c) => /^FAQ_SECTION_\d+$/.test(str(c["category_type"])))
      .sort((a, b) => Number(/\d+$/.exec(str(a["category_type"]))?.[0]) - Number(/\d+$/.exec(str(b["category_type"]))?.[0]));
    const clean = (s: string) => s.replace(/\s*\n+\s*/g, " ").replace(/\|/g, "/").trim();
    const item = (c: Row) => `${clean(str(c["name"]))} | ${clean(str(c["description"]))}`;

    const updateSections = async (slug: string, mutate: (sections: Record<string, unknown>[]) => void) => {
      const page = await tx.page.findUnique({ where: { slug } });
      if (!page) return;
      const sections = page.sections as unknown as Record<string, unknown>[];
      mutate(sections);
      await tx.page.update({ where: { slug }, data: { sections: sections as Prisma.InputJsonValue, updatedByName: "Migration" } });
      rep.migrated++;
    };
    const find = (sections: Record<string, unknown>[], type: string, heading?: RegExp) => sections.find((s) => s["type"] === type && (!heading || heading.test(String(s["heading"]))));

    if (faqs.length) {
      await updateSections("cau-hoi-thuong-gap-ve-khoa-hoc", (s) => {
        const faq = find(s, "faq");
        if (faq) faq["items"] = faqs.map(item);
      });
      rep.notes.push(`FAQ: ${faqs.length} câu hỏi thật từ category FAQ_SECTION_* thay nội dung mẫu`);
    }

    const roadmap = data.categories
      .filter((c) => /^HOME_LEARNING_ROADMAP_(SEP|STEP)_\d+$/.test(str(c["category_type"])))
      .sort((a, b) => Number(/\d+$/.exec(str(a["category_type"]))?.[0]) - Number(/\d+$/.exec(str(b["category_type"]))?.[0]));
    const programs = data.categories.filter((c) => /^HOME_PROGRAM_OVERVIEW_SECTION_\d+$/.test(str(c["category_type"]))).sort((a, b) => Number(/\d+$/.exec(str(a["category_type"]))?.[0]) - Number(/\d+$/.exec(str(b["category_type"]))?.[0]));
    const programTarget = data.categories.find((c) => str(c["category_type"]) === "HOME_PROGRAM_OVERVIEW" && /Target/i.test(str(c["name"])));
    const LINKS: [RegExp, string][] = [
      [/Foundation/i, "/khoa-hoc/pte-nen-tang-pre-pte"],
      [/Core/i, "/khoa-hoc/pte-50-58"],
      [/Target/i, "/khoa-hoc/pte-65-79"],
      [/1 Kèm 1/i, "/khoa-hoc/kem-1-1"],
      [/Du Học/i, "/du-hoc-di-lam-dinh-cu"],
      [/Định Cư/i, "/du-hoc-di-lam-dinh-cu"],
    ];
    const withLink = (c: Row) => `${item(c)} | ${LINKS.find(([re]) => re.test(str(c["name"])))?.[1] ?? ""}`.replace(/ \| $/, "");
    const text = (type: string) => byType(type)[0];

    await updateSections("trang-chu", (s) => {
      const steps = find(s, "steps");
      if (steps && roadmap.length) {
        steps["items"] = roadmap.map(item);
        const t = text("HOME_LEARNING_ROADMAP");
        if (t) {
          steps["heading"] = clean(str(t["name"]));
          steps["body"] = clean(str(t["description"]));
        }
      }
      const prog = find(s, "programs");
      const list = [...programs, ...(programTarget ? [programTarget] : [])];
      if (prog && list.length) {
        prog["items"] = list.map(withLink);
        const t = byType("HOME_PROGRAM_OVERVIEW").find((c) => !/Target/i.test(str(c["name"])));
        if (t) prog["heading"] = clean(str(t["name"]));
      }
      for (const [type, secType] of [["HOME_COURSE_FEATURED", "courses"], ["HOME_TEACHER_FEATURED", "teachers"], ["HOME_NEWS_LATEST", "articles"], ["HOME_COMMUNITY", "community"]] as const) {
        const t = text(type);
        const sec = find(s, secType);
        if (t && sec) {
          sec["heading"] = clean(str(t["name"]));
          if (str(t["description"])) sec["body"] = clean(str(t["description"]));
        }
      }
    });
    rep.notes.push(`Trang chủ: ${roadmap.length} bước lộ trình, ${programs.length + (programTarget ? 1 : 0)} chương trình và tiêu đề các khối từ category HOME_*`);

    const audience = data.categories.filter((c) => /^ABOUT_TARGET_AUDIENCE_SECTION_\d+$/.test(str(c["category_type"]))).sort((a, b) => Number(/\d+$/.exec(str(a["category_type"]))?.[0]) - Number(/\d+$/.exec(str(b["category_type"]))?.[0]));
    const about = data.information.find((i) => str(i["category_type"]) === "ABOUT");
    await updateSections("gioi-thieu-pte-ipass", (s) => {
      const aud = find(s, "features", /đối tượng/i);
      if (aud && audience.length) aud["items"] = audience.map((c) => item({ ...c, name: str(c["name"]).replace(/"/g, ""), description: str(c["description"]).replace(/^"|"$/g, "") }));
      const mission = find(s, "text", /sứ mệnh/i);
      const vision = find(s, "text", /tầm nhìn/i);
      if (about) {
        if (mission && str(about["mission"])) mission["body"] = str(about["mission"]).startsWith("<") ? str(about["mission"]) : `<p>${str(about["mission"])}</p>`;
        if (vision && str(about["vision"])) vision["body"] = str(about["vision"]).startsWith("<") ? str(about["vision"]) : `<p>${str(about["vision"])}</p>`;
        if (str(about["video"])) s.push({ type: "text", heading: "Video giới thiệu", body: "", imageUrl: str(about["image"]) || undefined, buttonUrl: str(about["video"]), items: [] });
      }
    });
    if (about) {
      const html = str(about["content"]);
      await tx.page.update({
        where: { slug: "gioi-thieu-pte-ipass" },
        data: { summary: str(about["description"]).slice(0, 297) + (str(about["description"]).length > 297 ? "…" : ""), content: html || undefined, updatedByName: "Migration" },
      });
      rep.notes.push("Giới thiệu: sứ mệnh/tầm nhìn/nội dung/video và 6 đối tượng phù hợp từ bảng information + category ABOUT_*");
    }
    rep.skipped += data.categories.length - rep.migrated;
    rep.notes.push("Còn lại của bảng category (menu, header/footer, phân loại kiến thức rỗng, banner placement…) được thay bằng menu sinh từ dữ liệu + cấu hình site-config → không migrate");
  });

  // ── LOAD ─────────────────────────────────────────────────────────────────
  console.log(APPLY ? "Chế độ APPLY: ghi vào database mới" : "Chế độ DRY-RUN: không ghi (thêm --apply để ghi)");
  try {
    await prisma.$transaction(
      async (tx) => {
        currentTx = tx;
        for (const run of plan) await run();
        if (!APPLY) throw new DryRun();
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
  }
  await legacy.end();

  // ── VERIFY & REPORT ──────────────────────────────────────────────────────
  const verify = APPLY
    ? {
        users: await prisma.legacyMap.count({ where: { source: "user" } }),
        courses: await prisma.legacyMap.count({ where: { source: "course" } }),
        teachers: await prisma.legacyMap.count({ where: { source: "teacher" } }),
        articles: await prisma.legacyMap.count({ where: { source: "news" } }),
        submissions: await prisma.legacyMap.count({ where: { source: "consultation" } }),
        banners: await prisma.legacyMap.count({ where: { source: "banner" } }),
        orphanArticles: await prisma.article.count({ where: { category: undefined } }),
      }
    : null;
  const out = { mode: APPLY ? "apply" : "dry-run", at: new Date().toISOString(), steps: report, issues, verify };
  const dir = resolve("..", "..", "_backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `migration-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  for (const r of report) console.log(`${r.step}: legacy=${r.legacyCount} migrated=${r.migrated} skipped=${r.skipped}`);
  console.log(`Báo cáo: ${file}`);
}

class DryRun extends Error {}

/** Rollback: xóa các bản ghi đã tạo bởi migrate (theo legacy_map), theo thứ tự phụ thuộc ngược. */
async function rollback() {
  const order = ["form_submissions", "articles", "testimonials", "media_items", "banners", "branches", "courses", "teachers", "users"];
  await prisma.$transaction(async (tx) => {
    for (const table of order) {
      const maps = await tx.legacyMap.findMany({ where: { targetTable: table } });
      const ids = maps.map((m) => m.targetId);
      if (!ids.length) continue;
      const del = (tx as unknown as Record<string, { deleteMany(a: object): Promise<{ count: number }> }>)[
        { form_submissions: "formSubmission", articles: "article", testimonials: "testimonial", media_items: "mediaItem", banners: "banner", branches: "branch", courses: "course", teachers: "teacher", users: "user" }[table] as string
      ];
      const r = await del?.deleteMany({ where: { id: { in: ids } } });
      console.log(`rollback ${table}: ${r?.count ?? 0}`);
      await tx.legacyMap.deleteMany({ where: { targetTable: table } });
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import type { Prisma } from "@prisma/client";
import { bannerSchema, type BannerInput } from "../../contract/banners/schemas";
import type { Banner as BannerDto } from "../../contract/banners/types";
import { mediaSchema, type MediaInput } from "../../contract/media/schemas";
import type { MediaItem as MediaDto } from "../../contract/media/types";
import { testimonialSchema, type TestimonialInput } from "../../contract/testimonials/schemas";
import type { Testimonial as TestimonialDto } from "../../contract/testimonials/types";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, day, iso, parseDay } from "../../core/crud/dto";
import { publishGuard } from "../../core/crud/guards";

// ── Cảm nhận / câu chuyện thành công ───────────────────────────────────────
const tInclude = { course: { select: { name: true } } } as const;
type TestimonialRow = Prisma.TestimonialGetPayload<object> & { course?: { name: string } | null };

const toTestimonialDto = (t: TestimonialRow): TestimonialDto =>
  compact({
    id: t.id,
    studentName: t.studentName,
    headline: t.headline,
    quote: t.quote,
    avatarUrl: t.avatarUrl ?? undefined,
    scoreBefore: t.scoreBefore ?? undefined,
    scoreAfter: t.scoreAfter,
    rating: t.rating,
    courseId: t.courseId ?? undefined,
    courseName: t.course?.name,
    videoUrl: t.videoUrl ?? undefined,
    isFeatured: t.isFeatured,
    status: t.status,
    sortOrder: t.sortOrder,
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  });

const tData = (i: TestimonialInput) => ({
  studentName: i.studentName,
  headline: i.headline,
  quote: i.quote,
  avatarUrl: i.avatarUrl ?? null,
  scoreBefore: i.scoreBefore ?? null,
  scoreAfter: i.scoreAfter,
  rating: i.rating,
  courseId: i.courseId ?? null,
  videoUrl: i.videoUrl ?? null,
  isFeatured: i.isFeatured,
  status: i.status,
  sortOrder: i.sortOrder,
});

export const testimonialService = createCrudService<TestimonialRow & { id: string }, TestimonialDto, TestimonialInput>({
  resource: "testimonial",
  label: "cảm nhận học viên",
  table: "testimonials",
  delegate: (db) => db.testimonial,
  include: tInclude,
  schema: testimonialSchema,
  toDtos: (rows) => rows.map(toTestimonialDto),
  searchColumns: ["student_name", "headline", "quote"],
  filters: { status: (v) => ({ status: v }), courseId: (v) => ({ courseId: v }), isFeatured: (v) => ({ isFeatured: v === "true" }) },
  sortable: { studentName: (d) => ({ studentName: d }), scoreAfter: (d) => ({ scoreAfter: d }), rating: (d) => ({ rating: d }), sortOrder: (d) => ({ sortOrder: d }), status: (d) => ({ status: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "sortOrder", sortOrder: "asc" },
  entityLabel: (t) => `${t.studentName} – ${t.headline}`,
  guard: publishGuard<TestimonialRow & { id: string }>("testimonial"),
  toCreateData: tData,
  toUpdateData: tData,
});

// ── Banner ──────────────────────────────────────────────────────────────────
type BannerRow = Prisma.BannerGetPayload<object>;

const toBannerDto = (b: BannerRow): BannerDto =>
  compact({
    id: b.id,
    title: b.title,
    placement: b.placement,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl ?? undefined,
    linkUrl: b.linkUrl ?? undefined,
    altText: b.altText ?? undefined,
    startAt: day(b.startAt),
    endAt: day(b.endAt),
    status: b.status,
    sortOrder: b.sortOrder,
    createdAt: iso(b.createdAt),
    updatedAt: iso(b.updatedAt),
  });

const bData = (i: BannerInput) => ({
  title: i.title,
  placement: i.placement,
  imageUrl: i.imageUrl,
  mobileImageUrl: i.mobileImageUrl ?? null,
  linkUrl: i.linkUrl ?? null,
  altText: i.altText ?? null,
  startAt: parseDay(i.startAt),
  endAt: parseDay(i.endAt),
  status: i.status,
  sortOrder: i.sortOrder,
});

export const bannerService = createCrudService<BannerRow, BannerDto, BannerInput>({
  resource: "banner",
  label: "banner",
  table: "banners",
  delegate: (db) => db.banner,
  schema: bannerSchema,
  toDtos: (rows) => rows.map(toBannerDto),
  searchColumns: ["title", "alt_text"],
  filters: { placement: (v) => ({ placement: v }), status: (v) => ({ status: v }) },
  sortable: { title: (d) => ({ title: d }), placement: (d) => ({ placement: d }), sortOrder: (d) => ({ sortOrder: d }), status: (d) => ({ status: d }), startAt: (d) => ({ startAt: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "sortOrder", sortOrder: "asc" },
  entityLabel: (b) => b.title,
  toCreateData: bData,
  toUpdateData: bData,
});

// ── Thư viện media ──────────────────────────────────────────────────────────
type MediaRow = Prisma.MediaItemGetPayload<object>;

const toMediaDto = (m: MediaRow): MediaDto =>
  compact({
    id: m.id,
    name: m.name,
    kind: m.kind,
    url: m.url,
    mimeType: m.mimeType ?? undefined,
    sizeKb: m.sizeKb ?? undefined,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    altText: m.altText ?? undefined,
    folder: m.folder,
    tags: m.tags,
    createdAt: iso(m.createdAt),
    updatedAt: iso(m.updatedAt),
  });

const mData = (i: MediaInput) => ({
  name: i.name,
  kind: i.kind,
  url: i.url,
  mimeType: i.mimeType ?? null,
  sizeKb: i.sizeKb ?? null,
  width: i.width ?? null,
  height: i.height ?? null,
  altText: i.altText ?? null,
  folder: i.folder,
  tags: i.tags,
});

export const mediaService = createCrudService<MediaRow, MediaDto, MediaInput>({
  resource: "media",
  label: "tệp media",
  table: "media_items",
  delegate: (db) => db.mediaItem,
  schema: mediaSchema,
  toDtos: (rows) => rows.map(toMediaDto),
  searchColumns: ["name", "alt_text"],
  filters: { kind: (v) => ({ kind: v }), folder: (v) => ({ folder: v }) },
  sortable: { name: (d) => ({ name: d }), kind: (d) => ({ kind: d }), sizeKb: (d) => ({ sizeKb: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "createdAt", sortOrder: "desc" },
  entityLabel: (m) => m.name,
  toCreateData: mData,
  toUpdateData: mData,
});

export const testimonialsRouter = crudRouter("testimonial", testimonialService, { label: "cảm nhận học viên" });
export const bannersRouter = crudRouter("banner", bannerService, { label: "banner" });
export const mediaRouter = crudRouter("media", mediaService, { label: "tệp media" });

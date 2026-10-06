import type { Prisma } from "@prisma/client";
import { articleCategorySchema, articleSchema, tagSchema, type ArticleCategoryInput, type ArticleInput, type TagInput } from "../../contract/articles/schemas";
import type { Article as ArticleDto, ArticleCategory as CategoryDto, Tag as TagDto } from "../../contract/articles/types";
import { cmsPageSchema, type CmsPageInput } from "../../contract/cms-pages/schemas";
import type { CmsPage as PageDto } from "../../contract/cms-pages/types";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, iso, isoOrNull } from "../../core/crud/dto";
import { publishGuard } from "../../core/crud/guards";
import { conflict } from "../../core/http/errors";

// ── Trang (CMS) ─────────────────────────────────────────────────────────────
type PageRow = Prisma.PageGetPayload<object>;

const toPageDto = (p: PageRow): PageDto =>
  compact({
    id: p.id,
    title: p.title,
    slug: p.slug,
    template: p.template,
    status: p.status,
    summary: p.summary ?? undefined,
    content: p.content ?? undefined,
    sections: p.sections as unknown as PageDto["sections"],
    metaTitle: p.metaTitle ?? undefined,
    metaDescription: p.metaDescription ?? undefined,
    canonicalUrl: p.canonicalUrl ?? undefined,
    noindex: p.noindex,
    publishedAt: isoOrNull(p.publishedAt),
    updatedByName: p.updatedByName ?? undefined,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  });

/** publishedAt đặt đúng lần đầu chuyển sang published, giữ nguyên các lần sau. */
const publishedAt = (status: string, current: { publishedAt: Date | null } | undefined): Date | null => (status === "published" ? (current?.publishedAt ?? new Date()) : (current?.publishedAt ?? null));

const pageFields = (i: CmsPageInput) => ({
  title: i.title,
  slug: i.slug,
  template: i.template,
  status: i.status,
  summary: i.summary ?? null,
  content: i.content ?? null,
  sections: i.sections as unknown as Prisma.InputJsonValue,
  metaTitle: i.metaTitle ?? null,
  metaDescription: i.metaDescription ?? null,
  canonicalUrl: i.canonicalUrl ?? null,
  noindex: i.noindex,
});

export const pageService = createCrudService<PageRow, PageDto, CmsPageInput>({
  resource: "page",
  label: "trang",
  table: "pages",
  delegate: (db) => db.page,
  schema: cmsPageSchema,
  toDtos: (rows) => rows.map(toPageDto),
  searchColumns: ["title", "slug", "summary"],
  filters: { status: (v) => ({ status: v }), template: (v) => ({ template: v }) },
  sortable: { title: (d) => ({ title: d }), slug: (d) => ({ slug: d }), status: (d) => ({ status: d }), template: (d) => ({ template: d }), updatedAt: (d) => ({ updatedAt: d }), publishedAt: (d) => ({ publishedAt: d }) },
  defaultSort: { sortBy: "updatedAt", sortOrder: "desc" },
  entityLabel: (p) => p.title,
  uniqueFields: { slug: { field: "slug", message: "Slug đã tồn tại" } },
  guard: publishGuard<PageRow>("page"),
  toCreateData: (input, { auth }) => ({ ...pageFields(input), publishedAt: publishedAt(input.status, undefined), updatedByName: auth?.name ?? null }),
  toUpdateData: (input, current, { auth }) => ({ ...pageFields(input), publishedAt: publishedAt(input.status, current), updatedByName: auth?.name ?? null }),
});

// ── Danh mục bài viết ───────────────────────────────────────────────────────
const catInclude = { _count: { select: { articles: true } } } satisfies Prisma.ArticleCategoryInclude;
type CatRow = Prisma.ArticleCategoryGetPayload<{ include: typeof catInclude }>;

const toCategoryDto = (c: CatRow): CategoryDto =>
  compact({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? undefined, sortOrder: c.sortOrder, isActive: c.isActive, articleCount: c._count.articles, createdAt: iso(c.createdAt), updatedAt: iso(c.updatedAt) });

const catData = (i: ArticleCategoryInput) => ({ name: i.name, slug: i.slug, description: i.description ?? null, sortOrder: i.sortOrder, isActive: i.isActive });

export const articleCategoryService = createCrudService<CatRow, CategoryDto, ArticleCategoryInput>({
  resource: "taxonomy",
  label: "danh mục bài viết",
  table: "article_categories",
  delegate: (db) => db.articleCategory,
  include: catInclude,
  schema: articleCategorySchema,
  toDtos: (rows) => rows.map(toCategoryDto),
  searchColumns: ["name", "slug"],
  filters: { isActive: (v) => ({ isActive: v === "true" }) },
  sortable: { name: (d) => ({ name: d }), sortOrder: (d) => ({ sortOrder: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "sortOrder", sortOrder: "asc" },
  entityLabel: (c) => c.name,
  uniqueFields: { slug: { field: "slug", message: "Slug đã tồn tại" } },
  toCreateData: catData,
  toUpdateData: catData,
  beforeDelete: (c) => {
    if (c._count.articles > 0) throw conflict("Danh mục còn bài viết, hãy chuyển bài viết sang danh mục khác trước");
  },
});

// ── Tag ─────────────────────────────────────────────────────────────────────
const tagInclude = { _count: { select: { articles: true } } } satisfies Prisma.TagInclude;
type TagRow = Prisma.TagGetPayload<{ include: typeof tagInclude }>;

const toTagDto = (t: TagRow): TagDto => ({ id: t.id, name: t.name, slug: t.slug, articleCount: t._count.articles, createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt) });

export const tagService = createCrudService<TagRow, TagDto, TagInput>({
  resource: "taxonomy",
  label: "tag",
  table: "tags",
  delegate: (db) => db.tag,
  include: tagInclude,
  schema: tagSchema,
  toDtos: (rows) => rows.map(toTagDto),
  searchColumns: ["name", "slug"],
  sortable: { name: (d) => ({ name: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "name", sortOrder: "asc" },
  entityLabel: (t) => t.name,
  uniqueFields: { name: { field: "name", message: "Tag đã tồn tại" }, slug: { field: "slug", message: "Slug đã tồn tại" } },
  toCreateData: (i) => ({ name: i.name, slug: i.slug }),
  toUpdateData: (i) => ({ name: i.name, slug: i.slug }),
});

// ── Bài viết ────────────────────────────────────────────────────────────────
const include = { category: true, author: { select: { fullName: true } }, tags: { include: { tag: true } } } satisfies Prisma.ArticleInclude;
type ArticleRow = Prisma.ArticleGetPayload<{ include: typeof include }>;

/** ~200 từ/phút, tối thiểu 1 phút (API tính, không do client gửi). */
const readingMinutes = (content: string) => Math.max(1, Math.round(content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 200));

const toArticleDto = (a: ArticleRow): ArticleDto =>
  compact({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    content: a.content,
    coverUrl: a.coverUrl ?? undefined,
    categoryId: a.categoryId,
    categoryName: a.category.name,
    tagIds: a.tags.map((t) => t.tagId),
    tagNames: a.tags.map((t) => t.tag.name),
    authorId: a.authorId ?? undefined,
    authorName: a.author?.fullName,
    isFeatured: a.isFeatured,
    status: a.status,
    publishedAt: isoOrNull(a.publishedAt),
    metaTitle: a.metaTitle ?? undefined,
    metaDescription: a.metaDescription ?? undefined,
    readingMinutes: a.readingMinutes,
    viewCount: a.viewCount,
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  });

const articleFields = (i: ArticleInput) => ({
  title: i.title,
  slug: i.slug,
  excerpt: i.excerpt,
  content: i.content,
  coverUrl: i.coverUrl ?? null,
  categoryId: i.categoryId,
  isFeatured: i.isFeatured,
  status: i.status,
  metaTitle: i.metaTitle ?? null,
  metaDescription: i.metaDescription ?? null,
  readingMinutes: readingMinutes(i.content),
});
const tagLinks = (ids: string[]) => [...new Set(ids)].map((tagId) => ({ tag: { connect: { id: tagId } } }));

export const articleService = createCrudService<ArticleRow, ArticleDto, ArticleInput>({
  resource: "article",
  label: "bài viết",
  table: "articles",
  delegate: (db) => db.article,
  include,
  schema: articleSchema,
  toDtos: (rows) => rows.map(toArticleDto),
  searchColumns: ["title", "excerpt", "slug"],
  filters: {
    status: (v) => ({ status: v }),
    categoryId: (v) => ({ categoryId: v }),
    authorId: (v) => ({ authorId: v }),
    tagId: (v) => ({ tags: { some: { tagId: v } } }),
    isFeatured: (v) => ({ isFeatured: v === "true" }),
  },
  sortable: { title: (d) => ({ title: d }), status: (d) => ({ status: d }), publishedAt: (d) => ({ publishedAt: d }), createdAt: (d) => ({ createdAt: d }), updatedAt: (d) => ({ updatedAt: d }), viewCount: (d) => ({ viewCount: d }) },
  defaultSort: { sortBy: "updatedAt", sortOrder: "desc" },
  entityLabel: (a) => a.title,
  uniqueFields: { slug: { field: "slug", message: "Slug đã tồn tại" } },
  guard: publishGuard<ArticleRow>("article"),
  toCreateData: (input, { auth }) => ({
    ...articleFields(input),
    authorId: input.authorId ?? auth?.userId ?? null,
    publishedAt: publishedAt(input.status, undefined),
    tags: { create: tagLinks(input.tagIds) },
  }),
  toUpdateData: (input, current) => ({
    ...articleFields(input),
    ...(input.authorId ? { authorId: input.authorId } : {}),
    publishedAt: publishedAt(input.status, current),
    tags: { deleteMany: {}, create: tagLinks(input.tagIds) },
  }),
});

export const pagesRouter = crudRouter("page", pageService, { label: "trang" });
export const articleCategoriesRouter = crudRouter("taxonomy", articleCategoryService, { label: "danh mục bài viết" });
export const tagsRouter = crudRouter("taxonomy", tagService, { label: "tag" });
export const articlesRouter = crudRouter("article", articleService, { label: "bài viết" });

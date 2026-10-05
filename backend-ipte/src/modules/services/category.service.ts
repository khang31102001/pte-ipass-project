import { Prisma, $Enums } from "@prisma/client";
import prisma from "@config/database";

import { CategoryDAO } from "@dao/category.dao";
import { category } from "@prisma/client";

import { CategoryRequestDTO } from "@dto/CategoryRequestDTO";

// (Tuỳ chọn) Khai báo type đầu vào tương tự CourseListQuery
type CategoryListQuery = {
    q?: string;
    categoryName?: string;
    categoryType?: string; // hoặc $Enums.category_type nếu có enum
    slug?: string;
    url?: string;
    level?: number;
    parentId?: number;
    parentCategoryType?: string;
    sortBy?: keyof Prisma.categoryOrderByWithRelationInput | "createdAt";
    orderBy?: "asc" | "desc";
    page?: number;
    pageSize?: number;
};

type CourseSummary = {
    id: number;
    code: string | null;
    name: string;
    slug: string | null;
    title: string | null;
    level: string;
    mode: string;
    language: string | null;
    price: Prisma.Decimal | null;
    duration: string | null;
    start_date: Date | null;
    end_date: Date | null;
    image: string | null;
    tuition: string | null;
    schedule: string | null;
};

type MenuNode = {
    id: number;
    name: string;
    url: string | null;
    slug: string | null;
    icon: string | null;
    is_featured: boolean;
    is_disable: boolean;
    category_type: string;
    description?: string | null; // chỉ gắn ở root
    courses?: CourseSummary[] | null; // mảng khóa học
    children?: MenuNode[] | null;
};

type CategoryNode = {
    categoryId: number;
    name: string | null;
    slug: string | null;
    url: string | null;
    parent_id: number | null;
    icon: string | null;
    is_featured: boolean;
    is_disable: boolean;
    category_type: string;
    description: string | null;
    level: number | null;
    children: CategoryNode[];
};

export class CategoryService {
    private categoryDAO: CategoryDAO;
    constructor() {
        this.categoryDAO = new CategoryDAO();
    }

    static async createCategory(request: CategoryRequestDTO): Promise<category> {
        const desiredSlug = request.slug || request.name;
        const uniqueSlug = await ensureUniqueSlug(desiredSlug!);
        request.slug = uniqueSlug;
        const data = mapToCategoryEntityCreate(request);
        try {
            const newCategory = await prisma.category.create({
                data,
            });
            return newCategory;
        } catch (err) {
            if (isCategoryIdConflict(err)) {
                await resyncCategorySequence();
                // Retry once after sequence is fixed
                return prisma.category.create({ data });
            }
            throw err;
        }
    }

    static async updateCategory(
        categoryId: number,
        request: CategoryRequestDTO
    ): Promise<category | null> {
        const existingCategory = await prisma.category.findUnique({
            where: { category_id: categoryId },
        });
        if (!existingCategory) {
            return null;
        }
        if (request.slug && request.slug !== existingCategory.slug) {
            const uniqueSlug = await ensureUniqueSlug(request.slug);
            request.slug = uniqueSlug;
        }
        const data = mapToCategoryEntityUpdate(request);
        const updatedCategory = await prisma.category.update({
            where: { category_id: categoryId },
            data,
        });
        return updatedCategory;
    }

    static async deleteCategory(categoryId: number): Promise<void> {
        await prisma.$transaction(async (tx) => {
            // Collect target category and all of its descendants, then delete them in one query.
            const categories = await tx.category.findMany({
                select: { category_id: true, parent_id: true },
            });

            const targetExists = categories.some((c) => c.category_id === categoryId);
            if (!targetExists) {
                throw new Error("CATEGORY_NOT_FOUND");
            }

            const childrenMap = new Map<number, number[]>();
            for (const c of categories) {
                const parentId = c.parent_id != null ? Number(c.parent_id) : null;
                if (parentId != null) {
                    const list = childrenMap.get(parentId) ?? [];
                    list.push(c.category_id);
                    childrenMap.set(parentId, list);
                }
            }

            const toDelete = new Set<number>([categoryId]);
            const stack: number[] = [categoryId];

            while (stack.length > 0) {
                const current = stack.pop() as number;
                const children = childrenMap.get(current) ?? [];
                for (const childId of children) {
                    if (!toDelete.has(childId)) {
                        toDelete.add(childId);
                        stack.push(childId);
                    }
                }
            }

            const idsToDelete = Array.from(toDelete);

            // Remove category links on dependent tables before deleting categories.
            await tx.course.updateMany({
                where: { category_id: { in: idsToDelete } },
                data: { category_id: null },
            });

            await tx.news.updateMany({
                where: { category_id: { in: idsToDelete } },
                data: { category_id: null },
            });

            await tx.category.deleteMany({
                where: { category_id: { in: idsToDelete } },
            });
        });
    }

    static async getCategories(query: CategoryListQuery) {
        const {
            q,
            categoryName,
            categoryType,
            slug,
            url,
            level,
            parentId,
            parentCategoryType,
            sortBy: sort_by = "created_at",
            orderBy: sort_order = "asc",
            page = 1,
            pageSize = 20,
        } = query ?? {};

        let parentIdValue = parentId;

        if (parentCategoryType) {
            const category = await prisma.category.findFirst({
                where: {
                    category_type: {
                        equals: parentCategoryType,
                    },
                },
                select: { category_id: true },
            });
            parentIdValue = category?.category_id || parentIdValue;
        }

        // where giống listCourses (AND các điều kiện, có q -> OR nhiều field)
        const where: Prisma.categoryWhereInput = {
            AND: [
                q
                    ? {
                          OR: [
                              {
                                  name: {
                                      contains: q,
                                      mode: "insensitive",
                                  },
                              },
                              {
                                  slug: {
                                      contains: q,
                                      mode: "insensitive",
                                  },
                              },
                              {
                                  url: {
                                      contains: q,
                                      mode: "insensitive",
                                  },
                                  level: { equals: level },
                              },
                          ],
                      }
                    : {},
                categoryName
                    ? {
                          name: {
                              contains: categoryName,
                              mode: "insensitive",
                          },
                      }
                    : {},
                categoryType
                    ? {
                          // nếu categoryType là enum:
                          category_type: {
                              equals: categoryType,
                          },
                      }
                    : {},
                slug ? { slug: { equals: slug } } : {},
                url
                    ? {
                          url: {
                              contains: url,
                              mode: "insensitive",
                          },
                      }
                    : {},
                level != null ? { level: { equals: level } } : {},
                parentIdValue != null ? { parent_id: { equals: parentIdValue } } : {},
            ],
        };

        // orderBy động như listCourses
        const orderBy: Prisma.categoryOrderByWithRelationInput = {
            [sort_by]: sort_order,
        } as Prisma.categoryOrderByWithRelationInput;

        // phân trang an toàn như listCourses
        const safePage = Math.max(1, page);
        const safePageSize = Math.max(1, Math.min(pageSize, 100));
        const skip = (safePage - 1) * safePageSize;
        const take = safePageSize;

        const [items, total] = await Promise.all([
            prisma.category.findMany({ where, orderBy, skip, take }),
            prisma.category.count({ where }),
        ]);

        return {
            items,
            page: safePage,
            page_size: take,
            total,
            total_pages: Math.ceil(total / take),
        };
    }

    async getHeaderMenu(): Promise<MenuNode[]> {
        const rows = (await this.categoryDAO.findAllByCategoryType("HEADER_MENU")) as any[];

        // Build n-level tree
        const byId = new Map<number, MenuNode>();
        const childrenBucket = new Map<number, MenuNode[]>();
        const roots: MenuNode[] = [];

        // init nodes
        for (const r of rows) {
            const id = Number(r.category_id);
            byId.set(id, {
                id,
                name: r.name,
                url: r.url,
                slug: r.slug ?? null,
                icon: r.icon,
                is_featured: Boolean(r.is_featured),
                is_disable: Boolean(r.is_disable),
                category_type: r.category_type,
                children: [],
            });
        }
        // attach to parent or collect as root
        for (const r of rows as any[]) {
            const node = byId.get(Number(r.category_id))!;
            if (r.parent_id == null) {
                roots.push(node);
            } else {
                const parentId = Number(r.parent_id);
                const parent = byId.get(parentId);
                if (parent) {
                    (parent.children ??= []).push(node);
                } else {
                    // Nếu parent chưa có (edge case), bucket lại rồi nối sau:
                    const list = childrenBucket.get(parentId) ?? [];
                    list.push(node);
                    childrenBucket.set(parentId, list);
                }
            }
        }

        return roots;
    }

    static async getCategoryById(id?: number) {
        return await prisma.category.findUnique({
            where: { category_id: id },
        });
    }

    static async getCategoryTree(
        slugOrUrl?: string,
        categoryType?: string,
        name?: string
    ): Promise<CategoryNode[] | CategoryNode | null> {
        // 1) Lấy tất cả categories (để có thể include children của categoryType, kể cả khác type)
        const categories = await prisma.category.findMany({
            orderBy: { category_id: "asc" },
        });
        if (!categories.length) return slugOrUrl ? null : [];

        // 2) Khởi tạo map node
        const byId = new Map<number, CategoryNode>();
        for (const r of categories) {
            const id = Number(r.category_id);
            const parentId = r.parent_id == null ? null : Number(r.parent_id);
            byId.set(id, {
                categoryId: id,
                name: (r as any).name ?? null, // cột "name" trong DB
                slug: r.slug,
                url: r.url,
                parent_id: parentId,
                icon: r.icon,
                is_featured: Boolean(r.is_featured),
                is_disable: Boolean(r.is_disable),
                category_type: r.category_type,
                description: r.description,
                level: r.level,
                children: [],
            });
        }

        // 3) Gắn parent/child theo parent_id (không lọc theo type ở bước attach)
        const rootsAll: CategoryNode[] = [];
        for (const r of categories) {
            const id = Number(r.category_id);
            const node = byId.get(id)!;
            const parentId = node.parent_id;

            const isRoot = parentId == null || parentId === id || !byId.has(parentId);

            if (isRoot) {
                rootsAll.push(node);
            } else {
                const parent = byId.get(parentId)!;
                parent.children.push(node);
            }
        }

        // 4) Nếu có slugOrUrl: trả về subtree của node khớp slug/url
        if (slugOrUrl) {
            let target: CategoryNode | undefined;
            for (const n of byId.values()) {
                if (n.slug === slugOrUrl || n.url === slugOrUrl) {
                    target = n;
                    break;
                }
            }
            return target ?? null;
        }

        // 5) Không có slugOrUrl: nếu có categoryType -> trả về các root thuộc type đó,
        //    nhưng vẫn include toàn bộ con cháu (đã attach ở bước 3).
        if (categoryType) {
            // Root của "nhóm type" = node có category_type = categoryType và:
            // - hoặc không có parent,
            // - hoặc parent có category_type KHÁC categoryType,
            // - hoặc parent không tồn tại (edge-case)
            const isTypeRoot = (n: CategoryNode) => {
                if (n.category_type !== categoryType) return false;
                const pid = n.parent_id;
                if (pid == null || pid === n.categoryId || !byId.has(pid)) return true;
                const pNode = byId.get(pid)!;
                return pNode.category_type !== categoryType;
            };

            const typeRoots = Array.from(byId.values()).filter(isTypeRoot);

            if (name) {
                return filterTreeByName(typeRoots, name);
            }

            return typeRoots;
        }

        // 6) Nếu không lọc gì: trả toàn bộ roots (mọi type)
        return rootsAll;
    }
}
const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

function filterTreeByName(nodes: CategoryNode[], keyword: string): CategoryNode[] {
    const needle = norm(keyword);

    const dfs = (n: CategoryNode): CategoryNode | null => {
        const keptChildren = (n.children ?? [])
            .map(dfs)
            .filter((x): x is CategoryNode => x !== null);

        const isMatch = norm(n.name).includes(needle);
        if (isMatch || keptChildren.length) {
            return { ...n, children: keptChildren };
        }
        return null;
    };

    return nodes.map(dfs).filter((x): x is CategoryNode => x !== null);
}

function mapToCategoryEntityCreate(request: CategoryRequestDTO) {
    const data: Prisma.categoryCreateInput = {
        name: request.name,
        slug: request.slug,
        category_type: request.categoryType ? request.categoryType.toUpperCase() : "",
        ...(request.icon && { icon: request.icon }),
        ...(request.description && { description: request.description }),
        ...(request.parentId !== undefined && { parent_id: request.parentId }),
        ...(request.metaTitle && { meta_title: request.metaTitle }),
        ...(request.metaDescription && { meta_description: request.metaDescription }),
        ...(request.h1Heading && { h1_heading: request.h1Heading }),
        ...(request.seoContentTop && { seo_content_top: request.seoContentTop }),
        ...(request.seoContentBottom && { seo_content_bottom: request.seoContentBottom }),
        ...(request.canonicalUrl && { canonical_url: request.canonicalUrl }),
        ...(request.noindex !== undefined && { noindex: request.noindex }),
        ...(request.url && { url: request.url }),
        ...(request.level !== undefined && { level: request.level }),
        ...(request.isFeatured !== undefined && { is_featured: request.isFeatured }),
        ...(request.isDisable !== undefined && { is_disable: request.isDisable }),
        created_at: new Date(),
        created_by: "system",
        version: 1,
    };
    return data;
}
function mapToCategoryEntityUpdate(request: CategoryRequestDTO) {
    const data: Prisma.categoryUpdateInput = {
        name: request.name,
        slug: request.slug,
        category_type: request.categoryType ? request.categoryType.toUpperCase() : "",
        ...(request.icon && { icon: request.icon }),
        ...(request.description && { description: request.description }),
        ...(request.parentId !== undefined && { parent_id: request.parentId }),
        ...(request.metaTitle && { meta_title: request.metaTitle }),
        ...(request.metaDescription && { meta_description: request.metaDescription }),
        ...(request.h1Heading && { h1_heading: request.h1Heading }),
        ...(request.seoContentTop && { seo_content_top: request.seoContentTop }),
        ...(request.seoContentBottom && { seo_content_bottom: request.seoContentBottom }),
        ...(request.canonicalUrl && { canonical_url: request.canonicalUrl }),
        ...(request.noindex !== undefined && { noindex: request.noindex }),
        ...(request.url && { url: request.url }),
        ...(request.level !== undefined && { level: request.level }),
        ...(request.isFeatured !== undefined && { is_featured: request.isFeatured }),
        ...(request.isDisable !== undefined && { is_disable: request.isDisable }),
        updated_at: new Date(),
        updated_by: "system",
        version: { increment: 1 },
    };
    return data;
}
async function ensureUniqueSlug(slug: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (await prisma.category.findFirst({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
    }

    return uniqueSlug;
}

function isCategoryIdConflict(err: unknown): err is Prisma.PrismaClientKnownRequestError {
    return (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        Array.isArray(err.meta?.target) &&
        err.meta.target.includes("category_id")
    );
}

async function resyncCategorySequence() {
    const result = (await prisma.$queryRawUnsafe(
        "SELECT COALESCE(MAX(category_id), 0) + 1 AS next FROM category"
    )) as Array<{ next: bigint }>;
    const nextVal = result?.[0]?.next ?? 1n;
    await prisma.$queryRawUnsafe(
        `SELECT setval('category_category_id_seq', ${nextVal.toString()})`
    );
}

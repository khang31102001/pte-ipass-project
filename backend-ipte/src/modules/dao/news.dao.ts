import { Prisma, category, news } from "@prisma/client";

import prisma from "@config/database";

type NewsJoined = {
    id: number;
    image: string;
    title: string;
    description: string;
    content: string;
    category: string | null;
    authorName: string | null;
    authorAvatar: string | null;
};

export type NewsWithAuthorName = news & { author_name: string | null };
export type NewsWithAuthorAndCategory = NewsWithAuthorName & { category_type: string | null };

const newsInclude = {
    user: {
        select: {
            full_name: true,
        },
    },
};

export const NEWS_LIST_FIELDS = {
  news_id: true,
  author_id: true,
  category_id: true,

  image: true,
  title: true,
  slug: true,
  description: true,

  status: true,
  published_at: true,

  tags: true,
  keywords: true,

  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,

//   version: true,
  is_prominent: true,
  is_featured: true,
  is_disabled: true,

  category_type: true,

//   meta_title: true,
//   meta_description: true,

  audience: true,

//   schema_enabled: true,
//   schema_mode: true,
  // ❌ content: true  → cố tình KHÔNG khai báo
  // ❌ schema_data: true → vẫn loại vì rất nặng (nếu bạn muốn lấy thì thêm vào)

//   seo_score: true,
  start_date: true,
  end_date: true,
//   delete_image_url: true,
};

function mapNewsWithAuthor(
    record: any | null
): NewsWithAuthorName | null {
    if (!record) return null;
    const { user, ...rest } = record;
    return { ...rest, author_name: user?.full_name ?? null };
}

export class NewsDAO {
    async findById(id: number): Promise<NewsWithAuthorAndCategory | null> {
        const record = await prisma.news.findUnique({
            where: { news_id: id },
            include: newsInclude,
        });
        return this.attachCategoryType(mapNewsWithAuthor(record));
    }

    async findBySlug(slug: string): Promise<NewsWithAuthorAndCategory | null> {
        const record = await prisma.news.findUnique({
            where: { slug: slug },
            include: newsInclude,
        });
        return this.attachCategoryType(mapNewsWithAuthor(record));
    }

    async findAll(): Promise<NewsJoined[]> {
        const rows = await prisma.$queryRaw<NewsJoined[]>`SELECT n.news_id as id,
                    n.image,
                    n.title,
                    n.description,
                    n.content,
                    c.name AS category,
                    c.category_type AS "categoryType",
                    u.full_name AS authorName,
                    u.avatar AS authorAvatar
        FROM "category" c
        right JOIN "news" n ON n.category_id = c.category_id
        JOIN "user" u ON u.user_id = n.author_id
        order by id desc;`;
        return rows;
    }

    async create(data: Omit<news, "id" | "createdAt" | "updatedAt">): Promise<news> {
        return prisma.news.create({
            data,
        });
    }

    async update(id: number, data: Partial<Prisma.newsUpdateInput>): Promise<news> {
        return prisma.news.update({
            where: { news_id: id },
            data,
        });
    }

    async delete(id: number): Promise<news> {
        return prisma.news.delete({
            where: { news_id: id },
        });
    }

    async deleteByIds(ids: number[]): Promise<void> {
        await prisma.news.deleteMany({
            where: { news_id: { in: ids } },
        });
    }

    async findAllNews(filters: {
        search?: string;
        title?: string;
        slug?: string;
        description?: string;
        status?: any;
        isProminent?: number;
        categoryId?: number;
        categoryType?: string;
        isFeatured?: boolean;
        isDisabled?: boolean;
        sortBy?: string,
        orderBy?: string,
        page: number;
        pageSize: number;
    }): Promise<{
        items: NewsWithAuthorAndCategory[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const {
            search,
            title,
            slug,
            description,
            status,
            isProminent,
            categoryId,
            categoryType,
            isFeatured,
            isDisabled,
            sortBy: sort_by = "created_at",
            orderBy: sort_order = "desc",
            page,
            pageSize,
        } = filters;
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const whereClause: Prisma.newsWhereInput = {};
        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
            ];
        }
        if (title) {
            whereClause.title = {
                contains: title,
                mode: "insensitive",
            };
        }
        if (slug) {
            whereClause.slug = slug;
        }
        if (description) {
            whereClause.description = {
                contains: description,
                mode: "insensitive",
            };
        }
        if (status) {
            whereClause.status = status;
        }
        if (isProminent !== undefined) {
            whereClause.is_prominent = Boolean(isProminent);
        }
        if (categoryId) {
            whereClause.category_id = categoryId;
        }
        if (categoryType) {
            const categories = await prisma.category.findMany({
                where: {
                    category_type: categoryType,
                },
                select: {
                    category_id: true,
                },
            });
            const categoryIds = categories.map((cat) => cat.category_id);
            whereClause.category_id = {
                in: categoryIds,
            };
        }
        if (isFeatured !== undefined) {
            whereClause.is_featured = isFeatured;
        }
        if (isDisabled !== undefined) {
            whereClause.is_disabled = isDisabled;
        }
        const orderBy: Prisma.newsOrderByWithRelationInput = {
            [sort_by]: sort_order,
        } as Prisma.newsOrderByWithRelationInput;
        const [items, total] = await prisma.$transaction([
            prisma.news.findMany({
                where: whereClause,
                skip,
                take,
                orderBy,
                select: {
                    ...NEWS_LIST_FIELDS,
                    ...newsInclude,
                },
            }),
            prisma.news.count({ where: whereClause }),
        ]);
        const itemsWithAuthor = items.map((item) => mapNewsWithAuthor(item)!);
        const itemsWithCategory = await this.attachCategoryTypes(itemsWithAuthor);
        return {
            items: itemsWithCategory,
            page,
            page_size: pageSize,
            total,
            total_pages: Math.ceil(total / pageSize),
        };
    }

    private async attachCategoryTypes(
        items: NewsWithAuthorName[]
    ): Promise<NewsWithAuthorAndCategory[]> {
        const categoryIds = Array.from(
            new Set(items.map((n) => n.category_id).filter((id): id is number => !!id))
        );
        let categories: Pick<category, "category_id" | "category_type">[] = [];
        if (categoryIds.length) {
            categories = await prisma.category.findMany({
                where: { category_id: { in: categoryIds } },
                select: { category_id: true, category_type: true },
            });
        }
        const categoryMap = new Map<number, string | null>();
        categories.forEach((c) => categoryMap.set(c.category_id, c.category_type ?? null));

        return items.map((item) => ({
            ...item,
            category_type: categoryMap.get(item.category_id!) ?? null,
        }));
    }

    private async attachCategoryType(
        item: NewsWithAuthorName | null
    ): Promise<NewsWithAuthorAndCategory | null> {
        if (!item) return null;
        if (!item.category_id) return { ...item, category_type: null };
        const category = await prisma.category.findUnique({
            where: { category_id: item.category_id },
            select: { category_type: true },
        });
        return { ...item, category_type: category?.category_type ?? null };
    }
}

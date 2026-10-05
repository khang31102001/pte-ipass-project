import { document, Prisma } from "@prisma/client";

import prisma from "@config/database";
import { CategoryDAO } from "@dao/category.dao";

type documentJoined = {
    id: number;
    image: string;
    title: string;
    description: string;
    content: string;
    category: string | null;
    authorName: string | null;
    authorAvatar: string | null;
};

type ListOptions = {
    page: number;
    pageSize: number;
};

export class DocumentDAO {
    private categoryDAO: CategoryDAO;

    constructor() {
        this.categoryDAO = new CategoryDAO();
    }
    async findAll(): Promise<documentJoined[]> {
        const rows = await prisma.$queryRaw<documentJoined[]>`SELECT d.document_id as id,
                            d.image,
                            d.title,
                            d.description,
                            d.content,
                            c.name AS category,
                            u.full_name AS authorName,
                            u.avatar AS authorAvatar
            FROM "category" c
            right JOIN "document" d ON d.category_id = c.category_id
            JOIN "user" u ON u.user_id = d.author_id
            order by id desc;`;
        return rows;
    }

    async selectDocuments(
        categoryId: number,
        opts: ListOptions
    ): Promise<{
        items: document[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const { page, pageSize } = opts;
        const skip = (page - 1) * pageSize;
        const take = pageSize;

        const where: Prisma.documentWhereInput = { category_id: categoryId };

        const [items, total] = await prisma.$transaction([
            prisma.document.findMany({
                where,
                skip,
                take,
                orderBy: [{ is_prominent: "desc" }, { created_at: "desc" }],
            }),
            prisma.document.count({ where }),
        ]);

        return {
            items,
            page,
            page_size: pageSize,
            total,
            total_pages: Math.ceil(total / pageSize) || 1,
        };
    }

    async getDocuments(filters: {
        title?: string;
        slug?: string;
        description?: string;
        status?: any;
        isProminent?: boolean;
        categoryId?: number;
        categoryType?: string;
        startDate?: string;
        endDate?: string;
        page: number;
        pageSize: number;
    }): Promise<{
        items: document[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const {
            title,
            slug,
            description,
            status,
            isProminent,
            categoryId,
            categoryType,
            startDate,
            endDate,
            page,
            pageSize,
        } = filters;
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const where: Prisma.documentWhereInput = {};
        if (title) {
            where.title = {
                contains: title,
                mode: "insensitive",
            };
        }
        if (slug) {
            where.slug = slug;
        }
        if (status) {
            where.status = status;
        }
        if (isProminent !== undefined) {
            where.is_prominent = isProminent;
        }
        if (categoryId) {
            const categoryIdList = await this.categoryDAO.findAllCategoryIdsDeepByParentId(categoryId);
            where.category_id = {
                in: categoryIdList,
            };
        }
        if (categoryType) {
            where.category_type = { equals: categoryType };
        }
        if (description) {
            where.description = {
                contains: description,
                mode: "insensitive",
            };
        }
        if (startDate || endDate) {
            where.AND = [];

            if (endDate) {
                where.AND.push({
                    start_date: {
                        lte: new Date(endDate),
                    },
                });
            }

            if (startDate) {
                where.AND.push({
                    OR: [
                        {
                            end_date: {
                                gte: new Date(startDate),
                            },
                        },
                        {
                            end_date: null,
                        },
                    ],
                });
            }
        }
        const [items, total] = await prisma.$transaction([
            prisma.document.findMany({
                where,
                skip,
                take,
                orderBy: [{ is_prominent: "desc" }, { created_at: "desc" }],
            }),
            prisma.document.count({ where }),
        ]);
        return {
            items,
            page,
            page_size: pageSize,
            total,
            total_pages: Math.ceil(total / pageSize) || 1,
        };
    }

    async findById(id: number): Promise<document | null> {
        return prisma.document.findUnique({
            where: { document_id: id },
        });
    }

    async findBySlug(slug: string): Promise<document | null> {
        return prisma.document.findUnique({
            where: { slug: slug },
        });
    }

    async create(data: Prisma.documentCreateInput): Promise<document> {
        return prisma.document.create({
            data,
        });
    }

    async update(id: number, data: Prisma.documentUpdateInput): Promise<document> {
        return prisma.document.update({
            where: { document_id: id },
            data,
        });
    }

    async delete(id: number): Promise<document> {
        return prisma.document.delete({
            where: { document_id: id },
        });
    }

    async deleteByIds(ids: number[]): Promise<void> {
        await prisma.document.deleteMany({
            where: { document_id: { in: ids } },
        });
    }
}

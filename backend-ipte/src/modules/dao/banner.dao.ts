import { Prisma, banner } from "@prisma/client";

import prisma from "@config/database";

export type BannerFilters = {
    search?: string;
    placement?: string;
    isActive?: boolean;
    startDate?: Date | null;
    endDate?: Date | null;
    categoryId?: number;
    page: number;
    pageSize: number;
};

export class BannerDAO {
    async findById(id: number): Promise<banner | null> {
        return prisma.banner.findUnique({
            where: { banner_id: id },
        });
    }

    async findAll(filters: BannerFilters): Promise<{
        items: banner[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const { search, placement, isActive, startDate, endDate, categoryId, page, pageSize } = filters;
        const whereClause: Prisma.bannerWhereInput = {};

        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { sub_title: { contains: search, mode: "insensitive" } },
                { placement: { contains: search, mode: "insensitive" } },
            ];
        }
        if (placement) {
            whereClause.placement = {
                equals: placement,
                mode: "insensitive",
            };
        }
        if (isActive !== undefined) {
            whereClause.is_active = isActive;
        }
        if (startDate) {
            whereClause.start_date = { gte: startDate };
        }
        if (endDate) {
            whereClause.end_date = { lte: endDate };
        }
        if (categoryId) {
            whereClause.category_id = categoryId;
        }

        const skip = (page - 1) * pageSize;
        const take = pageSize;

        const [items, total] = await prisma.$transaction([
            prisma.banner.findMany({
                where: whereClause,
                skip,
                take,
                orderBy: [{ order: "asc" }, { created_at: "desc" }],
            }),
            prisma.banner.count({ where: whereClause }),
        ]);

        return {
            items,
            page,
            page_size: pageSize,
            total,
            total_pages: Math.ceil(total / pageSize),
        };
    }

    async create(data: Prisma.bannerCreateInput): Promise<banner> {
        return prisma.banner.create({ data });
    }

    async update(id: number, data: Prisma.bannerUpdateInput): Promise<banner> {
        return prisma.banner.update({
            where: { banner_id: id },
            data,
        });
    }

    async delete(id: number): Promise<banner> {
        return prisma.banner.delete({
            where: { banner_id: id },
        });
    }

    async deleteByIds(ids: number[]): Promise<void> {
        await prisma.banner.deleteMany({
            where: { banner_id: { in: ids } },
        });
    }
}

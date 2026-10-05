import { Prisma, consultation } from "@prisma/client";

import prisma from "@config/database";

export class ConsultationDAO {
    async create(data: Prisma.consultationUncheckedCreateInput): Promise<consultation> {
        return prisma.consultation.create({ data });
    }

    async findById(id: number): Promise<consultation | null> {
        return prisma.consultation.findUnique({
            where: { consultation_id: id },
        });
    }

    async findWithFilters(filters: {
        q?: string;
        status?: string;
        courseId?: number;
        page: number;
        pageSize: number;
    }): Promise<{
        items: consultation[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const whereClause: Prisma.consultationWhereInput = {};
        const orConditions: Prisma.consultationWhereInput[] = [];

        if (filters.q && filters.q.trim() !== "") {
            const keyword = filters.q.trim();
            orConditions.push(
                { name: { contains: keyword, mode: "insensitive" } },
                { email: { contains: keyword, mode: "insensitive" } },
                { phone: { contains: keyword, mode: "insensitive" } },
                { message: { contains: keyword, mode: "insensitive" } }
            );

            const numericId = Number(keyword);
            if (!Number.isNaN(numericId)) {
                orConditions.push({ consultation_id: numericId });
            }
        }

        if (filters.status) {
            whereClause.status = filters.status;
        }

        if (filters.courseId !== undefined) {
            whereClause.course_id = filters.courseId;
        }

        if (orConditions.length > 0) {
            whereClause.OR = orConditions;
        }

        const skip = (filters.page - 1) * filters.pageSize;
        const take = filters.pageSize;

        const [items, total] = await Promise.all([
            prisma.consultation.findMany({
                where: whereClause,
                skip,
                take,
                orderBy: { created_at: "desc" },
            }),
            prisma.consultation.count({ where: whereClause }),
        ]);

        const total_pages = Math.ceil(total / filters.pageSize);

        return {
            items,
            page: filters.page,
            page_size: filters.pageSize,
            total,
            total_pages,
        };
    }

    async update(id: number, data: Prisma.consultationUncheckedUpdateInput): Promise<consultation> {
        return prisma.consultation.update({
            where: { consultation_id: id },
            data,
        });
    }

    async delete(id: number): Promise<void> {
        await prisma.consultation.delete({
            where: { consultation_id: id },
        });
    }

    async deleteByIds(id: number[]): Promise<void> {
        await prisma.consultation.deleteMany({
            where: { consultation_id: { in: id } },
        });
    }
}

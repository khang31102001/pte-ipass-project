import { Prisma, student } from "@prisma/client";

import prisma from "@config/database";

export class StudentDAO {
    async create(data: Prisma.studentUncheckedCreateInput): Promise<student> {
        return prisma.student.create({ data });
    }

    async findById(id: number): Promise<student | null> {
        return prisma.student.findUnique({
            where: { student_id: id },
        });
    }

    async findBySlug(slug: string): Promise<student | null> {
        return prisma.student.findFirst({
            where: { slug },
        });
    }

    async findWithFilters(filters: {
        fullName?: string;
        slug?: string;
        phone?: string;
        courseId?: number;
        page: number;
        pageSize: number;
    }): Promise<{
        items: student[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const whereClause: Prisma.studentWhereInput = {};

        if (filters.fullName) {
            whereClause.full_name = {
                contains: filters.fullName,
                mode: "insensitive",
            };
        }
        if (filters.slug) {
            whereClause.slug = {
                contains: filters.slug,
                mode: "insensitive",
            };
        }
        if (filters.phone) {
            whereClause.phone = {
                contains: filters.phone,
                mode: "insensitive",
            };
        }
        if (filters.courseId !== undefined) {
            whereClause.course_id = filters.courseId;
        }

        const skip = (filters.page - 1) * filters.pageSize;
        const take = filters.pageSize;

        const [items, total] = await Promise.all([
            prisma.student.findMany({
                where: whereClause,
                skip,
                take,
            }),
            prisma.student.count({
                where: whereClause,
            }),
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

    async update(id: number, data: Prisma.studentUncheckedUpdateInput): Promise<student> {
        return prisma.student.update({
            where: { student_id: id },
            data,
        });
    }
}

import { Prisma, teacher } from "@prisma/client";

import prisma from "@config/database";

export class TeacherDAO {
    async findById(id: number): Promise<teacher | null> {
        return prisma.teacher.findUnique({
            where: { teacher_id: id },
        });
    }

    async findBySlug(slug: string): Promise<teacher | null> {
        return prisma.teacher.findFirst({
            where: { slug: slug },
        });
    }

    async findAll(): Promise<teacher[]> {
        return prisma.teacher.findMany();
    }

    async create(data: Prisma.teacherUncheckedCreateInput): Promise<teacher> {
        return prisma.teacher.create({
            data,
        });
    }

    async update(id: number, data: Prisma.teacherUncheckedUpdateInput): Promise<teacher> {
        return prisma.teacher.update({
            where: { teacher_id: id },
            data,
        });
    }

    async delete(id: number): Promise<teacher> {
        return prisma.teacher.delete({
            where: { teacher_id: id },
        });
    }

    async deleteByIds(ids: number[]): Promise<void> {
        await prisma.teacher.deleteMany({
            where: { teacher_id: { in: ids } },
        });
    }

    async findWithFilters(filters: {
        name?: string;
        slug?: string;
        overallScore?: number;
        listeningScore?: number;
        speakingScore?: number;
        readingScore?: number;
        writingScore?: number;
        page: number;
        pageSize: number;
    }): Promise<{
        items: teacher[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const whereClause: any = {};

        if (filters.name) {
            whereClause.name = {
                contains: filters.name,
                mode: "insensitive",
            };
        }
        if (filters.slug) {
            whereClause.slug = {
                contains: filters.slug,
                mode: "insensitive",
            };
        }
        if (filters.overallScore !== undefined) {
            whereClause.overall_score = filters.overallScore;
        }
        if (filters.listeningScore !== undefined) {
            whereClause.listening_score = filters.listeningScore;
        }
        if (filters.speakingScore !== undefined) {
            whereClause.speaking_score = filters.speakingScore;
        }
        if (filters.readingScore !== undefined) {
            whereClause.reading_score = filters.readingScore;
        }
        if (filters.writingScore !== undefined) {
            whereClause.writing_score = filters.writingScore;
        }

        const skip = (filters.page - 1) * filters.pageSize;
        const take = filters.pageSize;

        const [items, total] = await Promise.all([
            prisma.teacher.findMany({
                where: whereClause,
                skip,
                take,
            }),
            prisma.teacher.count({
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
}

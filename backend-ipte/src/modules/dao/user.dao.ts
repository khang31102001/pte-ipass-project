import { Prisma, user } from "@prisma/client";

import prisma from "@config/database";

export class UserDAO {
    async findById(id: number): Promise<user | null> {
        return prisma.user.findUnique({
            where: { user_id: id },
        });
    }

    async findByEmail(email: string): Promise<user | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    async findByUsername(username: string): Promise<user | null> {
        return prisma.user.findUnique({
            where: { username },
        });
    }

    async findAll({
        username,
        email,
        fullName,
        isActive,
        page,
        pageSize,
    }: {
        username?: string;
        email?: string;
        fullName?: string;
        isActive?: boolean;
        page: number;
        pageSize: number;
    }) {
        const whereClause: any = {};

        if (username) {
            whereClause.username = {
                contains: username,
                mode: "insensitive",
            };
        }
        if (email) {
            whereClause.email = {
                contains: email,
                mode: "insensitive",
            };
        }
        if (fullName) {
            whereClause.full_name = {
                contains: fullName,
                mode: "insensitive",
            };
        }
        if (isActive !== undefined) {
            whereClause.is_active = isActive;
        }

        const total = await prisma.user.count({ where: whereClause });
        const totalPages = Math.ceil(total / pageSize);
        const items = await prisma.user.findMany({
            where: whereClause,
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return {
            items,
            page,
            page_size: pageSize,
            total,
            total_pages: totalPages,
        };
    }

    async create(data: Prisma.userCreateInput): Promise<user> {
        return prisma.user.create({
            data,
        });
    }

    async update(id: number, data: Prisma.userUpdateInput): Promise<user> {
        return prisma.user.update({
            where: { user_id: id },
            data,
        });
    }

    async updateByUsername(username: string, data: Prisma.userUpdateInput): Promise<user> {
        return prisma.user.update({
            where: { username },
            data,
        });
    }

    async delete(id: number): Promise<user> {
        return prisma.user.delete({
            where: { user_id: id },
        });
    }
}

import prisma from "@config/database";
import { Prisma } from "@prisma/client";
import { SocialDTO, mapToSocialDTO } from "@dto/SocialDTO";

const DEFAULT_SOCIAL_CATEGORY = "CONTACT_COMMUNITY_LINK_";

function mapToEntity(data: any): any {
    return {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.url !== undefined && { social_url: data.url }),
        ...(data.categoryType !== undefined && { category_type: data.categoryType }),
        ...(data.categoryId !== undefined && { category_id: data.categoryId }),
    };
}

function resolveCategoryType(input?: string | null) {
    if (input && input.trim() !== "") return input.trim();
    return DEFAULT_SOCIAL_CATEGORY;
}

export class SocialService {
    static async create(payload: Partial<SocialDTO>) {
        const categoryType = resolveCategoryType(payload.categoryType);
        const data: Prisma.informationCreateInput = {
            ...mapToEntity({
                ...payload,
                categoryType,
            }),
            created_by: payload.createdBy || "system",
            updated_by: payload.updatedBy || "system",
            version: payload.version ?? 1,
        };

        const created = await prisma.information.create({ data });
        return mapToSocialDTO(created);
    }

    static async getById(id: number, categoryType = DEFAULT_SOCIAL_CATEGORY) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (
            !found ||
            (found.category_type && !found.category_type?.includes(DEFAULT_SOCIAL_CATEGORY))
        ) {
            throw new Error("SOCIAL_NOT_FOUND");
        }
        return mapToSocialDTO(found);
    }

    static async list(query: {
        categoryType?: string;
        category?: string;
        q?: string;
        page?: number;
        page_size?: number;
    }) {
        const page = Math.max(1, query.page || 1);
        const page_size = Math.max(1, Math.min(query.page_size || 20, 100));
        const categoryType = resolveCategoryType(query.categoryType ?? query.category);

        const where: Prisma.informationWhereInput = {
            category_type: { contains: categoryType },
            ...(query.q
                ? {
                      OR: [
                          { title: { contains: query.q, mode: "insensitive" } },
                          { description: { contains: query.q, mode: "insensitive" } },
                      ],
                  }
                : {}),
        };

        const skip = (page - 1) * page_size;
        const take = page_size;
        const [items, total] = await Promise.all([
            prisma.information.findMany({ where, skip, take }),
            prisma.information.count({ where }),
        ]);

        return {
            items: items.map(mapToSocialDTO),
            total,
        };
    }

    static async update(id: number, payload: Partial<SocialDTO>) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (
            !found ||
            (found.category_type && !found.category_type?.includes(DEFAULT_SOCIAL_CATEGORY))
        ) {
            throw new Error("SOCIAL_NOT_FOUND");
        }
        const data: Prisma.informationUpdateInput = {
            ...mapToEntity(payload),
            updated_at: new Date(),
            updated_by: payload.updatedBy || "system",
            version: { increment: 1 },
        };
        const updated = await prisma.information.update({
            where: { information_id: id },
            data,
        });
        return mapToSocialDTO(updated);
    }

    static async remove(id: number, categoryType = DEFAULT_SOCIAL_CATEGORY) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (
            !found ||
            (found.category_type && !found.category_type?.includes(DEFAULT_SOCIAL_CATEGORY))
        ) {
            throw new Error("SOCIAL_NOT_FOUND");
        }
        await prisma.information.delete({ where: { information_id: id } });
    }
}

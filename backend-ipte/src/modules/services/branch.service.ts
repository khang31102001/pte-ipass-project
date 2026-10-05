import prisma from "@config/database";
import { Prisma } from "@prisma/client";
import slugify from "slugify";
import { BranchDTO, mapToBranchDTO } from "@dto/BranchDTO";

const DEFAULT_BRANCH_CATEGORY = "CONTACT_BRANCH_ITEM";

function mapToEntity(data: any): any {
    return {
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.hotline !== undefined && { hotline: data.hotline }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.mapUrl !== undefined && { map_url: data.mapUrl }),
        ...(data.categoryType !== undefined && { category_type: data.categoryType }),
        ...(data.categoryId !== undefined && { category_id: data.categoryId }),
    };
}

function resolveCategoryType(input?: string | null) {
    if (input && input.trim() !== "") return input.trim();
    return DEFAULT_BRANCH_CATEGORY;
}

export class BranchService {
    static async createBranch(payload: Partial<BranchDTO>) {
        const slugSource = payload.slug ?? payload.title ?? "branch";
        const desiredSlug =
            (typeof slugSource === "string" ? slugSource.trim() : slugSource) || "branch";
        const uniqueSlug = await ensureUniqueInformationSlug(desiredSlug);
        const categoryType = resolveCategoryType(payload.categoryType);

        const data: Prisma.informationCreateInput = {
            ...mapToEntity({
                ...payload,
                slug: uniqueSlug,
                categoryType,
            }),
            created_by: payload.createdBy || "system",
            updated_by: payload.updatedBy || "system",
            version: payload.version ?? 1,
        };
        const created = await prisma.information.create({ data });

        return mapToBranchDTO(created);
    }

    static async getById(id: number, categoryType = DEFAULT_BRANCH_CATEGORY) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (!found || (found.category_type && found.category_type !== categoryType)) {
            throw new Error("BRANCH_NOT_FOUND");
        }
        return mapToBranchDTO(found);
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

        const where: Prisma.informationWhereInput = { category_type: categoryType };
        if (query.q) {
            where.OR = [
                { title: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
                { address: { contains: query.q, mode: "insensitive" } },
            ];
        }

        const skip = (page - 1) * page_size;
        const take = page_size;
        const [items, total] = await Promise.all([
            prisma.information.findMany({ where, skip, take }),
            prisma.information.count({ where }),
        ]);

        return {
            items: items.map(mapToBranchDTO),
            total,
        };
    }
    static async update(id: number, payload: Partial<BranchDTO>) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (!found || (found.category_type && found.category_type !== DEFAULT_BRANCH_CATEGORY)) {
            throw new Error("BRANCH_NOT_FOUND");
        }
        if (payload.slug) {
            const uniqueSlug = await ensureUniqueInformationSlug(payload.slug, id);
            payload.slug = uniqueSlug;
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
        return mapToBranchDTO(updated);
    }
    static async remove(id: number, categoryType = DEFAULT_BRANCH_CATEGORY) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (!found || (found.category_type && found.category_type !== categoryType)) {
            throw new Error("BRANCH_NOT_FOUND");
        }
        await prisma.information.delete({ where: { information_id: id } });
    }
}

async function ensureUniqueInformationSlug(
    base: string,
    informationIdToExclude?: number
): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true, trim: true }) || "branch";
    let candidate = baseSlug;
    let i = 1;
    while (true) {
        const found = await prisma.information.findFirst({
            where: {
                slug: candidate,
                ...(informationIdToExclude
                    ? { information_id: { not: informationIdToExclude } }
                    : {}),
            },
            select: { information_id: true },
        });
        if (!found) return candidate;
        i += 1;
        candidate = `${baseSlug}-${i}`;
    }
}

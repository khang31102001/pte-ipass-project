import prisma from "@config/database";
import { Prisma } from "@prisma/client";
import slugify from "slugify";
import { ImgbbResponse, ImgbbService } from "@services/imgbb.service";
import { AboutDTO, mapToAboutDTO } from "@dto/AboutDTO";
import { DeletedImageDAO } from "@dao/deletedImage.dao";

export type AboutUpdateDTO = Partial<AboutDTO>;

export type AboutListQuery = {
    q?: string;
    page?: number;
    page_size?: number;
    categoryType?: string;
    category?: string;
    aboutId?: number;
};

const DEFAULT_ABOUT_CATEGORY = "ABOUT";

function mapToEntity(data: any): any {
    return {
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.deleteImageUrl !== undefined && { delete_image_url: data.deleteImageUrl }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.mission !== undefined && { mission: data.mission }),
        ...(data.vision !== undefined && { vision: data.vision }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.hotline !== undefined && { hotline: data.hotline }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.mapUrl !== undefined && { map_url: data.mapUrl }),
        ...(data.categoryType !== undefined && { category_type: data.categoryType }),
        // ABOUT video maps into video on the information table.
        ...(data.video !== undefined && { video: data.video }),
        ...(data.categoryId !== undefined && { category_id: data.categoryId }),
    };
}

function resolveCategoryType(input?: string | null) {
    if (input && input.trim() !== "") return input.trim();
    return DEFAULT_ABOUT_CATEGORY;
}

function buildAboutWhere(
    q?: string,
    categoryType?: string,
    aboutId?: number
): Prisma.informationWhereInput {
    const orConditions: Prisma.informationWhereInput[] = [];

    if (q && q.trim() !== "") {
        const keyword = q.trim();
        orConditions.push(
            { title: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { mission: { contains: keyword, mode: "insensitive" } },
            { vision: { contains: keyword, mode: "insensitive" } },
            { address: { contains: keyword, mode: "insensitive" } }
        );

        const numericId = Number(keyword);
        if (!Number.isNaN(numericId)) {
            orConditions.push({ information_id: numericId });
        }
    }

    if (aboutId !== undefined) {
        orConditions.push({ information_id: aboutId });
    }

    const where: Prisma.informationWhereInput = {};
    if (orConditions.length > 0) {
        where.OR = orConditions;
    }
    if (categoryType) {
        where.category_type = categoryType;
    }
    return where;
}

export class AboutService {
    static async create(payload: Partial<AboutDTO>, file?: Express.Multer.File) {
        const slugSource = payload.slug ?? payload.title ?? "about";
        const desiredSlug =
            (typeof slugSource === "string" ? slugSource.trim() : slugSource) || "about";
        const uniqueSlug = await ensureUniqueInformationSlug(desiredSlug);

        let imgbbResponse: ImgbbResponse | undefined;
        try {
            imgbbResponse = await ImgbbService.uploadFromInput(payload.image ?? null, file, {
                fileName: uniqueSlug,
            });
        } catch (err: any) {
            console.error("Error uploading image to IMGBB:", err?.message || err);
            throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
        }
        const categoryType = resolveCategoryType(payload.categoryType);

        const data: Prisma.informationCreateInput = {
            ...mapToEntity({
                ...payload,
                slug: uniqueSlug,
                image: imgbbResponse?.data?.display_url ?? payload.image ?? null,
                deleteImageUrl: imgbbResponse?.data?.delete_url ?? payload.deleteImageUrl ?? null,
                categoryType,
                video: payload.video,
            }),
            created_by: payload.createdBy || "system",
            updated_by: payload.updatedBy || "system",
            version: payload.version ?? 1,
        };

        const created = await prisma.information.create({ data });
        return mapToAboutDTO(created);
    }

    static async getById(id: number, categoryType = DEFAULT_ABOUT_CATEGORY) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (!found || (found.category_type && found.category_type !== categoryType)) {
            throw new Error("ABOUT_NOT_FOUND");
        }
        return mapToAboutDTO(found);
    }

    static async list(query: AboutListQuery & { page_size?: number; aboutId?: number }) {
        const page = Math.max(1, query.page || 1);
        const page_size = Math.max(1, Math.min(query.page_size || 20, 100));
        const categoryType = resolveCategoryType(query.categoryType ?? query.category);
        const where = buildAboutWhere(query.q, categoryType, query.aboutId);

        const skip = (page - 1) * page_size;
        const take = page_size;

        const [items, total] = await Promise.all([
            prisma.information.findMany({ where, skip, take }),
            prisma.information.count({ where }),
        ]);

        return {
            items: items.map(mapToAboutDTO),
            total,
            page,
            page_size,
            total_pages: Math.ceil(total / page_size),
        };
    }

    static async update(id: number, payload: Partial<AboutDTO>, file?: Express.Multer.File) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (!found || (found.category_type && found.category_type !== DEFAULT_ABOUT_CATEGORY)) {
            throw new Error("ABOUT_NOT_FOUND");
        }

        const slugSource = payload.slug ?? payload.title ?? found.slug ?? found.title ?? "about";
        const desiredSlug =
            (typeof slugSource === "string" ? slugSource.trim() : slugSource) || "about";
        const uniqueSlug = await ensureUniqueInformationSlug(desiredSlug, id);

        const isImageChanged = payload.isImageChanged ?? payload.isImageChage ?? false;

        let imgbbResponse: ImgbbResponse | undefined;
        if (isImageChanged && (file || payload.image)) {
            try {
                imgbbResponse = await ImgbbService.uploadFromInput(payload.image ?? null, file, {
                    fileName: uniqueSlug,
                });
            } catch (err: any) {
                if (err) {
                    console.error("Error uploading image to IMGBB:", err?.message || err);
                }
                throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
            }
        }

        const image = isImageChanged
            ? (imgbbResponse?.data?.display_url ?? payload.image ?? null)
            : undefined;
        const deleteImageUrl = isImageChanged
            ? (imgbbResponse?.data?.delete_url ?? payload.deleteImageUrl ?? null)
            : undefined;

        const data: Prisma.informationUpdateInput = {
            ...mapToEntity({
                ...payload,
                slug: uniqueSlug,
                image,
                deleteImageUrl,
                video: payload.video,
            }),
            updated_at: new Date(),
            updated_by: payload.updatedBy || "system",
            version: { increment: 1 },
        };

        const updated = await prisma.information.update({
            where: { information_id: id },
            data,
        });
        if (isImageChanged && found.delete_image_url) {
            await new DeletedImageDAO().create(found.delete_image_url || "");
        }
        return mapToAboutDTO(updated);
    }

    static async remove(id: number, categoryType = DEFAULT_ABOUT_CATEGORY) {
        const found = await prisma.information.findUnique({ where: { information_id: id } });
        if (!found || (found.category_type && found.category_type !== categoryType)) {
            throw new Error("ABOUT_NOT_FOUND");
        }
        if (found.delete_image_url) {
            await new DeletedImageDAO().create(found.delete_image_url || "");
        }
        return prisma.information.delete({ where: { information_id: id } });
    }

    static async listByCategory(categoryType?: string) {
        const resolvedCategoryType = resolveCategoryType(categoryType);
        const items = await prisma.information.findMany({
            where: { category_type: resolvedCategoryType },
        });
        return items.map(mapToAboutDTO);
    }

    static async getBySlug(slug: string, categoryType = DEFAULT_ABOUT_CATEGORY) {
        const resolvedCategoryType = resolveCategoryType(categoryType);
        const item = await prisma.information.findFirst({
            where: { slug, category_type: resolvedCategoryType },
        });
        return item ? mapToAboutDTO(item) : null;
    }

    static async getByCategory(categoryType?: string) {
        const resolvedCategoryType = resolveCategoryType(categoryType);
        const item = await prisma.information.findFirst({
            where: { category_type: resolvedCategoryType },
        });
        return item ? mapToAboutDTO(item) : null;
    }
}

async function ensureUniqueInformationSlug(
    base: string,
    informationIdToExclude?: number
): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true, trim: true }) || "about";
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

import prisma from "@config/database";
import { Prisma } from "@prisma/client";
import { ImgbbResponse, ImgbbService } from "@services/imgbb.service";
import { MediaDTO, mapFromMediaToMediaDTO } from "@dto/MediaDTO";
import { MEDIA } from "@enums/media.enum";

function mapToEntity(data: any): any {
    return {};
}

export class MediaService {
    static async createMedia(payload: Partial<MediaDTO>, file?: Express.Multer.File) {
        let imgbbResponse: ImgbbResponse | undefined = undefined;
        if (file) {
            try {
                imgbbResponse = await ImgbbService.uploadFromInput(null, file);
            } catch (err: any) {
                console.error("Error uploading image to IMGBB:", err?.message || err);
                throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
            }
        }

        const data: Prisma.mediaCreateInput = {
            title: payload.title || "",
            description: payload.description || null,
            image_name: file?.originalname || null,
            image_url: imgbbResponse?.data?.display_url ?? payload.imageUrl ?? null,
            video_url: payload.videoUrl || null,
            media_type: imgbbResponse ? MEDIA.IMAGE : MEDIA.VIDEO,
            delete_image_url: imgbbResponse?.data?.delete_url ?? null,
            category_id: payload.categoryId || null,
            category_type: payload.categoryType || MEDIA.FACILITY,
            href: payload.href,
            created_at: new Date(),
            created_by: payload.createdBy || "system",
            updated_by: payload.updatedBy || "system",
            version: 1,
        };

        const created = await prisma.media.create({ data });
        return mapFromMediaToMediaDTO(created);
    }

    static async updateMedia(id: number, payload: Partial<MediaDTO>, file?: Express.Multer.File) {
        const existing = await prisma.media.findUnique({ where: { media_id: id } });
        if (!existing) throw new Error("MEDIA_NOT_FOUND");
        let imgbbResponse: ImgbbResponse | undefined = undefined;
        if (payload.isImageChanged && file) {
            try {
                imgbbResponse = await ImgbbService.uploadFromInput(null, file);
            } catch (err: any) {
                if (err) {
                    console.error("Error uploading image to IMGBB:", err?.message || err);
                }
                throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
            }
            if (existing.delete_image_url) {
                await prisma.deleted_image.create({
                    data: { delete_image_url: existing.delete_image_url },
                });
            }
        }

        const data: Prisma.mediaUpdateInput = {
            title: payload.title || existing.title,
            description: payload.description || existing.description,
            image_name: file?.originalname || existing.image_name,
            image_url: imgbbResponse?.data?.display_url || existing.image_url,
            delete_image_url: imgbbResponse?.data?.delete_url || existing.delete_image_url,
            video_url: payload.videoUrl || existing.video_url,
            category_id: payload.categoryId || existing.category_id,
            category_type: payload.categoryType || existing.category_type,
            is_disabled: payload.isDisabled || existing.is_disabled,
            href: payload.href || existing.href,
            updated_at: new Date(),
            updated_by: payload.updatedBy || existing.updated_by,
            version: (existing.version || 1) + 1,
        };

        const updated = await prisma.media.update({ where: { media_id: id }, data });
        return mapFromMediaToMediaDTO(updated);
    }

    static async listMedia(filters: {
        categoryId?: string | number;
        categoryType?: string;
        mediaType?: string;
        isDisabled?: Boolean | number;
        search?: string;
        categoryTypePrefix?: string;
        page: number;
        pageSize: number;
    }) {
        const whereClause: Prisma.mediaWhereInput = {};

        if (filters.categoryId !== undefined) {
            whereClause.category_id =
                typeof filters.categoryId === "string"
                    ? parseInt(filters.categoryId, 10)
                    : filters.categoryId;
        }
        if (filters.categoryType !== undefined) {
            whereClause.category_type = filters.categoryType;
        }
        if (filters.mediaType !== undefined) {
            whereClause.media_type = filters.mediaType;
        }
        if (filters.isDisabled !== undefined) {
            whereClause.is_disabled = Boolean(filters.isDisabled);
        }
        if (filters.search !== undefined) {
            whereClause.OR = [
                { title: { contains: filters.search, mode: "insensitive" } },
                { description: { contains: filters.search, mode: "insensitive" } },
            ];
        }
        if (filters.categoryTypePrefix !== undefined) {
            whereClause.category_type = { contains: filters.categoryTypePrefix, mode: "insensitive" };
        }
        const skip = (filters.page - 1) * filters.pageSize;
        const take = filters.pageSize;
        const [items, total] = await prisma.$transaction([
            prisma.media.findMany({
                where: whereClause,
                skip,
                take,
                orderBy: { created_at: "desc" },
            }),
            prisma.media.count({ where: whereClause }),
        ]);

        return {
            items: items.map(mapFromMediaToMediaDTO),
            page: filters.page,
            pageSize: filters.pageSize,
            total,
            totalPages: Math.ceil(total / filters.pageSize),
        };
    }

    static async getMediaById(id: number) {
        const media = await prisma.media.findUnique({ where: { media_id: id } });
        if (!media) return null;
        return mapFromMediaToMediaDTO(media);
    }

    static async deleteMedia(id: number) {
        const existing = await prisma.media.findUnique({ where: { media_id: id } });
        if (!existing) throw new Error("MEDIA_NOT_FOUND");
        await prisma.media.delete({ where: { media_id: id } });
        if (existing.delete_image_url) {
            await prisma.deleted_image.create({
                data: { delete_image_url: existing.delete_image_url },
            });
        }
        return;
    }
}

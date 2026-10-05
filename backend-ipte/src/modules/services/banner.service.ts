import prisma from "@config/database";
import { BannerDAO } from "@dao/banner.dao";
import { BannerDTO } from "@dto/BannerDTO";
import { ImgbbResponse, ImgbbService } from "@services/imgbb.service";
import { Prisma, banner } from "@prisma/client";
import { DeletedImageDAO } from "@dao/deletedImage.dao";

export type BannerResponse = {
    bannerId: number;
    title: string;
    subtitle: string;
    placement: string;
    image: string | null;
    deleteImageUrl: string | null;
    actionType: string;
    actionLabel: string;
    actionUrl: string | null;
    categoryId: number;
    isActive: boolean | null;
    order: number | null;
    startAt: Date | null;
    endAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    version: number | null;
};

export class BannerService {
    private bannerDAO: BannerDAO;
    private deletedImageDAO: DeletedImageDAO;

    constructor() {
        this.bannerDAO = new BannerDAO();
        this.deletedImageDAO = new DeletedImageDAO();
    }

    async getBanners(filters: {
        search?: string;
        placement?: string;
        isActive?: boolean;
        startAt?: string;
        endAt?: string;
        categoryId?: number;
        page: number;
        pageSize: number;
    }): Promise<{
        items: BannerResponse[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const result = await this.bannerDAO.findAll({
            search: filters.search,
            placement: filters.placement,
            isActive: filters.isActive,
            startDate: toDateOrNull(filters.startAt),
            endDate: toDateOrNull(filters.endAt),
            categoryId: filters.categoryId,
            page: filters.page,
            pageSize: filters.pageSize,
        });

        return {
            ...result,
            items: result.items.map(toBannerResponse),
        };
    }

    async getBannerById(id: number): Promise<BannerResponse> {
        const found = await this.bannerDAO.findById(id);
        if (!found) {
            throw new Error("BANNER_NOT_FOUND");
        }
        return toBannerResponse(found);
    }

    async createBanner(payload: BannerDTO, file?: Express.Multer.File): Promise<BannerResponse> {
        let imgbbResponse: ImgbbResponse | undefined;
        try {
            imgbbResponse = await ImgbbService.uploadFromInput(payload.image ?? null, file, {
                fileName: payload.title,
            });
        } catch (err: any) {
            console.error("Error uploading banner image:", err?.message || err);
            throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
        }

        const dates = extractDates(payload);
        const data = normalizeCreateInput({
            ...payload,
            ...dates,
            image: imgbbResponse?.data?.display_url ?? payload.image ?? null,
            deleteImageUrl: imgbbResponse?.data?.delete_url ?? payload.deleteImageUrl ?? null,
        });

        const created = await this.bannerDAO.create(data);
        return toBannerResponse(created);
    }

    async updateBanner(
        id: number,
        payload: Partial<BannerDTO>,
        file?: Express.Multer.File
    ): Promise<BannerResponse> {
        const existing = await this.bannerDAO.findById(id);
        if (!existing) {
            throw new Error("BANNER_NOT_FOUND");
        }

        let imgbbResponse: ImgbbResponse | undefined;
        if (payload.isImageChanged && (file || payload.image)) {
            try {
                imgbbResponse = await ImgbbService.uploadFromInput(
                    payload.image ?? null,
                    file,
                    { fileName: payload.title ?? existing.title }
                );
            } catch (err: any) {
                console.error("Error uploading banner image:", err?.message || err);
                throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
            }
        }

        const dates = extractDates(payload);
        const normalized = normalizeUpdateInput(
            {
                ...payload,
                ...dates,
                image: payload.isImageChanged
                    ? imgbbResponse?.data?.display_url ?? payload.image ?? null
                    : undefined,
                deleteImageUrl: payload.isImageChanged
                    ? imgbbResponse?.data?.delete_url ?? payload.deleteImageUrl ?? null
                    : undefined,
            },
        );

        if (imgbbResponse && existing.delete_image_url) {
            await this.deletedImageDAO.create(existing.delete_image_url);
        }

        const updated = await this.bannerDAO.update(id, normalized);
        return toBannerResponse(updated);
    }

    async deleteBanner(id: number): Promise<void> {
        const banner = await this.bannerDAO.findById(id);
        if (!banner) {
            throw new Error("BANNER_NOT_FOUND");
        }

        if (banner.delete_image_url) {
            await this.deletedImageDAO.create(banner.delete_image_url);
        }
        await this.bannerDAO.delete(id);
    }

    async deleteBannersByIds(ids: number[]): Promise<void> {
        const banners = await prisma.banner.findMany({
            where: { banner_id: { in: ids } },
            select: { banner_id: true, delete_image_url: true },
        });

        for (const banner of banners) {
            if (banner.delete_image_url) {
                await this.deletedImageDAO.create(banner.delete_image_url);
            }
        }

        await this.bannerDAO.deleteByIds(ids);
    }
}

function toBannerResponse(entity: banner): BannerResponse {
    return {
        bannerId: entity.banner_id,
        title: entity.title,
        subtitle: entity.sub_title,
        placement: entity.placement,
        image: entity.image ?? null,
        deleteImageUrl: entity.delete_image_url ?? null,
        actionType: entity.action_type,
        actionLabel: entity.action_label,
        actionUrl: entity.action_url ?? null,
        categoryId: entity.category_id,
        isActive: entity.is_active ?? null,
        order: entity.order ?? null,
        startAt: entity.start_date ?? null,
        endAt: entity.end_date ?? null,
        createdAt: entity.created_at ?? null,
        updatedAt: entity.updated_at ?? null,
        createdBy: entity.created_by ?? null,
        updatedBy: entity.updated_by ?? null,
        version: entity.version ?? null,
    };
}

function normalizeCreateInput(
    input: BannerDTO & {
        startDate?: Date | null;
        endDate?: Date | null;
        image?: string | null;
        deleteImageUrl?: string | null;
    }
): Prisma.bannerCreateInput {
    return {
        title: input.title,
        sub_title: input.subtitle,
        placement: input.placement,
        category: { connect: { category_id: input.categoryId } },
        action_type: input.actionType,
        action_label: input.actionLabel,
        ...(input.actionUrl && { action_url: input.actionUrl }),
        ...(input.image && { image: input.image }),
        ...(input.deleteImageUrl && { delete_image_url: input.deleteImageUrl }),
        ...(input.isActive !== undefined && { is_active: input.isActive }),
        ...(input.order !== undefined && { order: input.order }),
        ...(input.startDate !== undefined && { start_date: input.startDate }),
        ...(input.endDate !== undefined && { end_date: input.endDate }),
        created_by: input.createdBy || "system",
        updated_by: input.updatedBy || "system",
        version: 1,
    };
}

function normalizeUpdateInput(
    input: Partial<BannerDTO> & {
        startDate?: Date | null;
        endDate?: Date | null;
        image?: string | null;
        deleteImageUrl?: string | null;
    }
): Prisma.bannerUpdateInput {
    const data: Prisma.bannerUpdateInput = {
        updated_at: new Date(),
        updated_by: input.updatedBy || "system",
        version: { increment: 1 },
    };

    if (input.title !== undefined) data.title = input.title;
    if (input.subtitle !== undefined) data.sub_title = input.subtitle;
    if (input.placement !== undefined) data.placement = input.placement;
    if (input.actionType !== undefined) data.action_type = input.actionType;
    if (input.actionLabel !== undefined) data.action_label = input.actionLabel;
    if (input.actionUrl !== undefined) data.action_url = input.actionUrl;
    if (input.isActive !== undefined) data.is_active = input.isActive;
    if (input.order !== undefined) data.order = input.order;

    if (input.startDate !== undefined) data.start_date = input.startDate;
    if (input.endDate !== undefined) data.end_date = input.endDate;

    if (input.image !== undefined) data.image = input.image;
    if (input.deleteImageUrl !== undefined) data.delete_image_url = input.deleteImageUrl;
    if (input.categoryId !== undefined) {
        data.category = { connect: { category_id: input.categoryId } };
    }

    return data;
}

function toDateOrNull(value?: string | null): Date | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === "") {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function extractDates(payload: Partial<BannerDTO>) {
    const startDate = toDateOrNull(payload.startAt);
    const endDate = toDateOrNull(payload.endAt);
    const dateFields: { startDate?: Date | null; endDate?: Date | null } = {};
    if (startDate !== undefined) {
        dateFields.startDate = startDate;
    }
    if (endDate !== undefined) {
        dateFields.endDate = endDate;
    }
    return dateFields;
}

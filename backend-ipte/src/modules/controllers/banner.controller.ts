import { Request, Response } from "express";

import { BannerDTO } from "@dto/BannerDTO";
import { BannerService } from "@services/banner.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

const bannerService = new BannerService();

export class BannerController {
    async getBanners(req: Request, res: Response): Promise<void> {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));
        const { search, placement, isActive, startAt, endAt, categoryId } = req.query;

        try {
            const banners = await bannerService.getBanners({
                search: search as string | undefined,
                placement: placement as string | undefined,
                isActive: isActive !== undefined ? toBoolean(isActive as string) : undefined,
                startAt: startAt as string | undefined,
                endAt: endAt as string | undefined,
                categoryId: categoryId ? Number(categoryId) : undefined,
                page,
                pageSize,
            });
            res.status(200).json(camelCaseKeysDeep(banners));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch banners",
                error: error.message,
            });
        }
    }

    async getBannerById(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid banner ID." });
            return;
        }
        try {
            const banner = await bannerService.getBannerById(id);
            res.status(200).json(camelCaseKeysDeep(banner));
        } catch (error: any) {
            if (error?.message === "BANNER_NOT_FOUND") {
                res.status(404).json({ message: "Banner not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to fetch banner",
                error: error.message,
            });
        }
    }

    async createBanner(req: Request, res: Response): Promise<void> {
        let payload: BannerDTO;
        try {
            payload = parseJsonField<BannerDTO>(req);
        } catch {
            res.status(400).json({ message: "Invalid request payload" });
            return;
        }
        try {
            const { bannerId, banner_id, ...data } = payload as any;
            const banner = await bannerService.createBanner(data, req.file);
            await revalidate([TAGS.BRANCHES]);
            res.status(201).json(camelCaseKeysDeep(banner));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to create banner",
                error: error.message,
            });
        }
    }

    async updateBanner(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid banner ID." });
            return;
        }

        let payload: Partial<BannerDTO>;
        try {
            payload = parseJsonField<Partial<BannerDTO>>(req);
        } catch {
            res.status(400).json({ message: "Invalid request payload" });
            return;
        }
        try {
            const banner = await bannerService.updateBanner(id, payload, req.file);
            await revalidate([TAGS.BANNERS]);
            res.status(200).json(camelCaseKeysDeep(banner));
        } catch (error: any) {
            if (error?.message === "BANNER_NOT_FOUND") {
                res.status(404).json({ message: "Banner not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to update banner",
                error: error.message,
            });
        }
    }

    async deleteBanner(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid banner ID." });
            return;
        }
        try {
            await bannerService.deleteBanner(id);
            await revalidate([TAGS.BANNERS]);
            res.status(204).end();
        } catch (error: any) {
            if (error?.message === "BANNER_NOT_FOUND") {
                res.status(404).json({ message: "Banner not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to delete banner",
                error: error.message,
            });
        }
    }

    async deleteBannersByIds(req: Request, res: Response): Promise<void> {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number")) {
                res.status(400).json({ message: "Invalid banner ids." });
                return;
            }

            await bannerService.deleteBannersByIds(ids);
            await revalidate([TAGS.BANNERS]);
            res.status(204).end();
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to delete banners",
                error: error.message,
            });
        }
    }
}

function toBoolean(value: string): boolean {
    return ["true", "1", "yes"].includes(value.toLowerCase());
}

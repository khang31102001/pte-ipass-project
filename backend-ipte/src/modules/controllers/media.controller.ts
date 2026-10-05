import { Request, Response } from "express";
import { MediaService } from "@services/media.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { MediaDTO } from "@dto/MediaDTO";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

export class MediaController {
    async createMedia(req: Request, res: Response) {
        let payload: Partial<MediaDTO>;
        try {
            payload = parseJsonField<Partial<MediaDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const created = await MediaService.createMedia(payload, req.file);
            await revalidate([TAGS.MEDIA]);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (e) {
            res.status(500).json({ message: "Failed to create media." });
        }
    }

    async updateMedia(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid media_id." });
        let payload: Partial<MediaDTO>;
        try {
            payload = parseJsonField<Partial<MediaDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const updated = await MediaService.updateMedia(id, payload, req.file);
            await revalidate([TAGS.MEDIA]);
            res.json(camelCaseKeysDeep(updated));
        } catch (e: any) {
            if (e?.message === "MEDIA_NOT_FOUND")
                return res.status(404).json({ message: "Media not found." });
            res.status(500).json({ message: "Failed to update media." });
        }
    }
    async listMedia(req: Request, res: Response) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 15, 100));
            const { categoryId, categoryType, mediaType, isDisabled, search, categoryTypePrefix } = req.query;
            const medias = await MediaService.listMedia({
                categoryId: categoryId ? Number(categoryId) : undefined,
                categoryType: categoryType as string | undefined,
                mediaType: mediaType as string | undefined,
                isDisabled: isDisabled ? Boolean(isDisabled) : undefined,
                search: search as string | undefined,
                categoryTypePrefix: categoryTypePrefix as string | undefined,
                page,
                pageSize,
            });
            res.json(medias);
        } catch (e) {
            res.status(500).json({ message: "Failed to retrieve media." });
        }
    }

    async getMediaById(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid media_id." });
        try {
            const facility = await MediaService.getMediaById(id);
            if (!facility) return res.status(404).json({ message: "Facility not found." });
            res.json(facility);
        } catch (e) {
            res.status(500).json({ message: "Failed to retrieve facility." });
        }
    }
    async deleteMedia(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid media_id." });
        try {
            await MediaService.deleteMedia(id);
            await revalidate([TAGS.MEDIA]);
            res.status(204).send();
        } catch (e: any) {
            if (e?.message === "MEDIA_NOT_FOUND")
                return res.status(404).json({ message: "Media not found." });
            res.status(500).json({ message: "Failed to delete media." });
        }
    }
}

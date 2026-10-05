import { Request, Response } from "express";
import { SocialService } from "@services/social.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { SocialDTO } from "@dto/SocialDTO";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

export class SocialController {
    async create(req: Request, res: Response) {
        let payload: Partial<SocialDTO>;
        try {
            payload = parseJsonField<Partial<SocialDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const created = await SocialService.create(payload);
            await revalidate([TAGS.SOCIALS]);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (e) {
            res.status(500).json({ message: "Failed to create social." });
        }
    }

    async getById(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid social_id." });
        try {
            const data = await SocialService.getById(id);
            res.json(camelCaseKeysDeep(data));
        } catch (e: any) {
            if (e?.message === "SOCIAL_NOT_FOUND")
                return res.status(404).json({ message: "Social not found." });
            res.status(500).json({ message: "Failed to get social." });
        }
    }

    async list(req: Request, res: Response) {
        try {
            const { q, category, categoryType, page, pageSize } = req.query;
            const result = await SocialService.list({
                categoryType: (categoryType ?? category) as string | undefined,
                q: q as string | undefined,
                page: page ? Number(page) : undefined,
                page_size: pageSize ? Number(pageSize) : undefined,
            });
            res.json(camelCaseKeysDeep(result));
        } catch (e) {
            res.status(500).json({ message: "Failed to list socials." });
        }
    }

    async update(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid social_id." });
        let payload: Partial<SocialDTO>;
        try {
            payload = parseJsonField<Partial<SocialDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const updated = await SocialService.update(id, payload);
            await revalidate([TAGS.SOCIALS]);
            res.json(camelCaseKeysDeep(updated));
        } catch (e: any) {
            if (e?.message === "SOCIAL_NOT_FOUND")
                return res.status(404).json({ message: "Social not found." });
            res.status(500).json({ message: "Failed to update social." });
        }
    }

    async remove(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid social_id." });
        try {
            await SocialService.remove(id);
            await revalidate([TAGS.SOCIALS]);
            res.status(204).send();
        } catch (e: any) {
            if (e?.message === "SOCIAL_NOT_FOUND")
                return res.status(404).json({ message: "Social not found." });
            res.status(500).json({ message: "Failed to delete social." });
        }
    }
}

import { Request, Response } from "express";
import { AboutService } from "@services/about.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { AboutDTO } from "@dto/AboutDTO";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

export class AboutController {
    async create(req: Request, res: Response) {
        let payload: Partial<AboutDTO>;
        try {
            payload = parseJsonField<Partial<AboutDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const created = await AboutService.create(payload, req.file);
            await revalidate([TAGS.ABOUTS]);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (e) {
            res.status(500).json({ message: "Failed to create about." });
        }
    }

    async getById(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid about_id." });
        try {
            const data = await AboutService.getById(id);
            res.json(camelCaseKeysDeep(data));
        } catch (e: any) {
            if (e?.message === "ABOUT_NOT_FOUND")
                return res.status(404).json({ message: "About not found." });
            res.status(500).json({ message: "Failed to get about." });
        }
    }

    async list(req: Request, res: Response) {
        try {
            const { q, category, categoryType, page, pageSize, about_id, aboutId } = req.query;
            const result = await AboutService.list({
                categoryType: (categoryType ?? category) as string | undefined,
                q: q as string | undefined,
                page: page ? Number(page) : undefined,
                page_size: pageSize ? Number(pageSize) : undefined,
                aboutId: aboutId ? Number(aboutId) : about_id ? Number(about_id) : undefined,
            });
            res.json(camelCaseKeysDeep(result));
        } catch {
            res.status(500).json({ message: "Failed to list about." });
        }
    }

    async update(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid about_id." });
        let payload: Partial<AboutDTO>;
        try {
            payload = parseJsonField<Partial<AboutDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const updated = await AboutService.update(id, payload, req.file);
            await revalidate([updated.slug ? TAGS.detail(updated.slug) : TAGS.ABOUTS]);
            res.json(camelCaseKeysDeep(updated));
        } catch (e: any) {
            if (e?.message === "ABOUT_NOT_FOUND")
                return res.status(404).json({ message: "About not found." });
            res.status(500).json({ message: "Failed to update about." });
        }
    }

    async remove(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid about_id." });
        try {
            await AboutService.remove(id);
            await revalidate([TAGS.ABOUTS]);
            res.status(204).end();
        } catch (e: any) {
            if (e?.message === "ABOUT_NOT_FOUND")
                return res.status(404).json({ message: "About not found." });
            res.status(500).json({ message: "Failed to delete about." });
        }
    }

    async getDetail(req: Request, res: Response) {
        const { slug, category, categoryType } = req.query;
        let found;
        try {
            if (slug) {
                found = await AboutService.getBySlug(
                    slug as string,
                    (categoryType ?? category) as string | undefined
                );
            } else {
                found = await AboutService.getByCategory(
                    (categoryType ?? category) as string | undefined
                );
            }
            if (!found) return res.status(404).json({ message: "About not found." });
            res.json(camelCaseKeysDeep(found));
        } catch {
            res.status(500).json({ message: "Failed to get about detail." });
        }
    }
}

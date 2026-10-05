import { Request, Response } from "express";
import { NewsService } from "@services/news.service";
import { camelCaseKeysDeep } from "@utils/response";
import { getUserIdFromRequest } from "@utils/jwt";
import { parseJsonField } from "@utils/requestParser";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

const newsService = new NewsService();

export class NewsController {
    async getNewsAndTips(req: Request, res: Response): Promise<void> {
        try {
            const news = await newsService.getNewsAndTips();
            res.status(200).json(camelCaseKeysDeep(news));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch users",
                error: error.message,
            });
        }
    }

    async getAllNews(req: Request, res: Response): Promise<void> {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));
        const {
            search,
            title,
            description,
            slug,
            status,
            isProminent,
            categoryId,
            categoryType,
            isFeatured,
            isDisabled,
            orderBy,
            sortBy,
        } = req.query;

        try {
            const news = await newsService.getAllNews({
                search: search as string | undefined,
                title: title as string | undefined,
                description: description as string | undefined,
                slug: slug as string | undefined,
                status: status as any | undefined,
                isProminent: isProminent ? Number(isProminent) : undefined,
                categoryId: categoryId ? Number(categoryId) : undefined,
                categoryType: categoryType as string | undefined,
                isFeatured: isFeatured != null ? isFeatured === "true" : undefined,
                isDisabled: isDisabled != null ? isDisabled === "true" : undefined,
                orderBy: orderBy as "asc" | "desc" | undefined,
                sortBy: sortBy as "price" | "created_at" | "updated_at" | undefined,
                page,
                pageSize,
            });
            res.status(200).json(camelCaseKeysDeep(news));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch news",
                error: error.message,
            });
        }
    }

    async getNewsDetail(req: Request, res: Response): Promise<void> {
        try {
            const { id, slug } = req.query;
            const newsDetail = await newsService.getNewsDetail(
                id ? Number(id) : undefined,
                slug ? String(slug) : undefined
            );
            res.status(200).json(camelCaseKeysDeep(newsDetail));
        } catch (error: any) {
            if (error?.message === "NEWS_NOT_FOUND") {
                res.status(404).json({ message: "News not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to fetch news",
                error: error.message,
            });
        }
    }

    async createNews(req: Request, res: Response): Promise<void> {
        let payload: SeoEvaluationInput;
        try {
            payload = parseJsonField<SeoEvaluationInput>(req);
        } catch {
            res.status(400).json({ message: "Invalid request payload" });
            return;
        }
        try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            const { news_id, newsId, ...data } = payload as any;
            const news = await newsService.createNews({ ...data, author: userId }, req.file);
            await revalidate([TAGS.NEWS]);
            res.status(201).json(camelCaseKeysDeep(news));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to create news",
                error: error.message,
            });
        }
    }

    async getNewsById(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid news ID." });
            return;
        }
        try {
            const news = await newsService.getNewsById(id);
            res.status(200).json(camelCaseKeysDeep(news));
        } catch (error: any) {
            if (error?.message === "NEWS_NOT_FOUND") {
                res.status(404).json({ message: "News not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to fetch news",
                error: error.message,
            });
        }
    }
    async updateNews(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid news ID." });
            return;
        }
        let payload: Partial<SeoEvaluationInput>;
        try {
            payload = parseJsonField<Partial<SeoEvaluationInput>>(req);
        } catch {
            res.status(400).json({ message: "Invalid request payload" });
            return;
        }
        try {
            const news = await newsService.updateNews(id, payload, req.file);

            await revalidate([news.slug ? TAGS.detail(news.slug) : TAGS.NEWS]);

            res.status(200).json(camelCaseKeysDeep(news));
        } catch (error: any) {
            if (error?.message === "NEWS_NOT_FOUND") {
                res.status(404).json({ message: "News not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to update news",
                error: error.message,
            });
        }
    }

    async deleteNews(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid news ID." });
            return;
        }
        try {
            await newsService.deleteNews(id);
            await revalidate([TAGS.NEWS]);
            res.status(204).end();
        } catch (error: any) {
            if (error?.message === "NEWS_NOT_FOUND") {
                res.status(404).json({ message: "News not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to delete news",
                error: error.message,
            });
        }
    }

    async deleteNewsByIds(req: Request, res: Response) {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number")) {
                return res.status(400).json({ message: "Invalid news ids." });
            }

            await newsService.deleteNewsByIds(ids);
            await revalidate([TAGS.NEWS]);
            res.status(204).end();
        } catch (e: any) {
            return res.status(500).json({ message: "Failed to delete courses." });
        }
    }
}

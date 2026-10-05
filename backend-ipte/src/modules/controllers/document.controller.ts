import { DocumentService } from "@services/document.service";
import { camelCaseKeysDeep } from "@utils/response";
import { getUserIdFromRequest } from "@utils/jwt";
import { parseJsonField } from "@utils/requestParser";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint";

export class DocumentController {
    private documentService: DocumentService;
    constructor() {
        this.documentService = new DocumentService();
    }
    async selectDocuments(req: any, res: any) {
        try {
            const categoryId = parseInt(req.params.categoryId, 10);

            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.max(1, Math.min(Number(req.query.page_size) || 20, 100));

            const documents = await this.documentService.selectDocuments(categoryId, {
                page,
                pageSize,
            });
            res.status(200).json(camelCaseKeysDeep(documents));
        } catch (error) {
            res.status(500).json({
                message: "Failed to fetch documents by category id.",
            });
        }
    }

    async getDocuments(req: any, res: any) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));
            const {
                title,
                slug,
                description,
                status,
                isProminent,
                categoryId,
                categoryType,
                startDate,
                endDate,
            } = req.query;

            const documents = await this.documentService.getDocuments({
                title: title as string | undefined,
                slug: slug as string | undefined,
                description: description as string | undefined,
                status: status as string | undefined,
                isProminent: this.toOptionalBoolean(isProminent),
                categoryId: categoryId ? Number(categoryId) : undefined,
                categoryType: categoryType as string | undefined,
                startDate: startDate as string | undefined,
                endDate: endDate as string | undefined,
                page,
                pageSize,
            });
            res.status(200).json(camelCaseKeysDeep(documents));
        } catch (error) {
            res.status(500).json({
                message: "Failed to fetch document list.",
            });
        }
    }

    async createDocument(req: any, res: any) {
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

            const { document_id, documentId, ...data } = payload as any;
            const document = await this.documentService.createDocument(
                { ...data, author: userId },
                req.file
            );
            await revalidate([TAGS.DOCUMENTS]);
            res.status(201).json(camelCaseKeysDeep(document));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to create document",
                error: error.message,
            });
        }
    }

    async updateDocument(req: any, res: any) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid document ID." });
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
            const document = await this.documentService.updateDocument(id, payload, req.file);
            await revalidate([document.slug ? TAGS.detail(document.slug) : TAGS.DOCUMENTS]);
            res.status(200).json(camelCaseKeysDeep(document));
        } catch (error: any) {
            if (error?.message === "DOCUMENT_NOT_FOUND") {
                res.status(404).json({ message: "Document not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to update document",
                error: error.message,
            });
        }
    }

    async deleteDocument(req: any, res: any) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid document ID." });
            return;
        }

        try {
            await this.documentService.deleteDocument(id);
            await revalidate([TAGS.DOCUMENTS]);
            res.status(204).end();
        } catch (error: any) {
            if (error?.message === "DOCUMENT_NOT_FOUND") {
                res.status(404).json({ message: "Document not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to delete document",
                error: error.message,
            });
        }
    }

    async deleteDocumentByIds(req: any, res: any) {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number")) {
                return res.status(400).json({ message: "Invalid document ids." });
            }

            await this.documentService.deleteDocumentByIds(ids);
            await revalidate([TAGS.DOCUMENTS]);
            res.status(204).end();
        } catch (error: any) {
            return res.status(500).json({ message: "Failed to delete documents." });
        }
    }

    async getDocumentDetail(req: any, res: any) {
        try {
            const { id, slug } = req.query;
            const document = await this.documentService.getDocumentDetail(
                id ? Number(id) : undefined,
                slug ? String(slug) : undefined
            );
            res.status(200).json(camelCaseKeysDeep(document));
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch document." });
        }
    }

    private toOptionalBoolean(input: unknown): boolean | undefined {
        const value = Array.isArray(input) ? input[0] : input;
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value !== 0;
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (normalized === "true" || normalized === "1") return true;
            if (normalized === "false" || normalized === "0") return false;
        }
        return undefined;
    }
}

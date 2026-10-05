import { DocumentDAO } from "@dao/document.dao";
import { DeletedImageDAO } from "@dao/deletedImage.dao";
import prisma from "@config/database";
import { Prisma, document } from "@prisma/client";
import slugify from "slugify";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";
import { ImgbbResponse, ImgbbService } from "@services/imgbb.service";

type ListOptions = {
    page: number;
    pageSize: number;
};

export class DocumentService {
    private documentDAO: DocumentDAO;
    private deletedImageDAO: DeletedImageDAO;

    constructor() {
        this.documentDAO = new DocumentDAO();
        this.deletedImageDAO = new DeletedImageDAO();
    }

    async selectDocuments(categoryId: number, opts: ListOptions) {
        return this.documentDAO.selectDocuments(categoryId, opts);
    }

    async getDocuments(filters: {
        title?: string;
        slug?: string;
        description?: string;
        status?: any;
        isProminent?: boolean;
        categoryId?: number;
        categoryType?: string;
        startDate?: string;
        endDate?: string;
        page: number;
        pageSize: number;
    }) {
        return this.documentDAO.getDocuments(filters);
    }

    async createDocument(input: SeoEvaluationInput, file?: Express.Multer.File): Promise<document> {
        const desiredSlug = input.slug || input.title;
        const uniqueSlug = await ensureUniqueSlug(desiredSlug!);

        let imgbbResponse: ImgbbResponse | undefined;
        try {
            imgbbResponse = await ImgbbService.uploadFromInput(null, file, {
                fileName: uniqueSlug,
            });
        } catch (err: any) {
            console.error("Error uploading image to IMGBB:", err?.message || err);
            throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
        }

        const data = normalizeCreateInput({
            ...input,
            slug: uniqueSlug,
            image: imgbbResponse?.data?.display_url ?? input.image ?? null,
            deleteImageUrl: imgbbResponse?.data?.delete_url ?? input.deleteImageUrl ?? null,
        });

        try {
            const created = await this.documentDAO.create(data);
            return created;
        } catch (e: any) {
            if (e?.code === "P2002") {
                const field = e?.meta?.target?.[0] || "unknown";
                throw new Error(`DOCUMENT_CONFLICT_${field}`);
            }
            throw e;
        }
    }

    async updateDocument(
        id: number,
        data: Partial<SeoEvaluationInput>,
        file?: Express.Multer.File
    ): Promise<document> {
        const entity = await this.documentDAO.findById(id);
        if (!entity) {
            throw new Error("DOCUMENT_NOT_FOUND");
        }

        const payload: Partial<SeoEvaluationInput> = { ...data };
        if (payload.slug || payload.title) {
            const base = payload.slug || payload.title!;
            payload.slug = await ensureUniqueSlug(base, id);
        }

        let imgbbResponse: ImgbbResponse | undefined;
        if (payload.isImageChanged && file) {
            try {
                imgbbResponse = await ImgbbService.uploadFromInput(null, file, {
                    fileName: payload.slug || payload.title,
                });
            } catch (err: any) {
                if (err) {
                    console.error("Error uploading image to IMGBB:", err?.message || err);
                }
                throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || "UNKNOWN"}`);
            }
        }

        let image: string | undefined;
        let deleteImageUrl: string | undefined;
        if (imgbbResponse) {
            image = imgbbResponse?.data?.display_url;
            deleteImageUrl = imgbbResponse?.data?.delete_url;
        }

        const normalizedData = normalizeUpdateInput({
            ...payload,
            image: image ?? entity.image,
            deleteImageUrl: deleteImageUrl ?? entity.delete_image_url,
        });

        try {
            if (entity?.delete_image_url) {
                await this.deletedImageDAO.create(entity.delete_image_url);
            }
            return await this.documentDAO.update(id, normalizedData);
        } catch (e: any) {
            if (e?.code === "P2025") {
                throw new Error("DOCUMENT_NOT_FOUND");
            }
            if (e?.code === "P2002") {
                throw new Error("DOCUMENT_CONFLICT");
            }
            throw e;
        }
    }

    async deleteDocument(id: number): Promise<document> {
        const entity = await this.documentDAO.findById(id);
        if (!entity) {
            throw new Error("DOCUMENT_NOT_FOUND");
        }

        if (entity.delete_image_url) {
            await this.deletedImageDAO.create(entity.delete_image_url);
        }

        try {
            return await this.documentDAO.delete(id);
        } catch (e: any) {
            if (e?.code === "P2025") {
                throw new Error("DOCUMENT_NOT_FOUND");
            }
            throw e;
        }
    }

    async deleteDocumentByIds(ids: number[]): Promise<void> {
        const documents = await prisma.document.findMany({
            where: { document_id: { in: ids } },
            select: { document_id: true, delete_image_url: true },
        });

        for (const doc of documents) {
            if (doc.delete_image_url) {
                await this.deletedImageDAO.create(doc.delete_image_url);
            }
        }

        await this.documentDAO.deleteByIds(ids);
    }

    async getDocumentDetail(id?: number, slug?: string): Promise<any | null> {
        if (id !== undefined) {
            return this.documentDAO.findById(id);
        } else if (slug !== undefined) {
            return this.documentDAO.findBySlug(slug);
        } else {
            throw new Error("Either id or slug must be provided.");
        }
    }
}

async function ensureUniqueSlug(base: string, documentIdToExclude?: number): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true, trim: true }) || "document";
    let candidate = baseSlug;
    let i = 1;
    while (true) {
        const found = await prisma.document.findFirst({
            where: {
                slug: candidate,
                ...(documentIdToExclude ? { document_id: { not: documentIdToExclude } } : {}),
            },
            select: { document_id: true },
        });
        if (!found) return candidate;
        i += 1;
        candidate = `${baseSlug}-${i}`;
    }
}

function normalizeCreateInput(input: SeoEvaluationInput) {
    const data: Prisma.documentCreateInput = {
        slug: input.slug!,
        title: input.title,
        content: input.content!,
        ...(input.description && { description: input.description }),
        ...(input.status && { status: input.status }),
        ...(input.categoryId && { category_id: input.categoryId }),
        ...(input.categoryType && { category_type: input.categoryType }),
        ...(input.isDisabled !== undefined && { is_disabled: input.isDisabled }),
        ...(input.isFeatured !== undefined && { is_featured: input.isFeatured }),
        ...(input.isProminent !== undefined && { is_prominent: input.isProminent }),
        ...(input.image && { image: input.image }),
        ...(input.deleteImageUrl && { delete_image_url: input.deleteImageUrl }),
        ...(input.startDate && { start_date: new Date(input.startDate) }),
        ...(input.endDate && { end_date: new Date(input.endDate) }),
        ...(input.metaTitle && { meta_title: input.metaTitle }),
        ...(input.metaDescription && { meta_description: input.metaDescription }),
        ...(input.audience && input.audience.length > 0 && { audience: input.audience }),
        ...(input.tags && input.tags.length > 0 && { tags: input.tags }),
        ...(input.keywords && input.keywords.length > 0 && { keywords: input.keywords }),
        ...(input.schemaEnabled !== undefined && { schema_enabled: input.schemaEnabled }),
        ...(input.schemaMode && { schema_mode: input.schemaMode }),
        ...(input.schemaData && { schema_data: input.schemaData }),
        ...(input.author !== undefined &&
            input.author !== null && { author_id: input.author }),
        created_by: "system",
        updated_by: "system",
        version: 1,
    };
    return data;
}

function normalizeUpdateInput(input: Partial<SeoEvaluationInput>) {
    const data: Prisma.documentUpdateInput = {
        ...(input.slug && { slug: input.slug }),
        ...(input.title && { title: input.title }),
        ...(input.content && { content: input.content }),
        ...(input.description && { description: input.description }),
        ...(input.status && { status: input.status }),
        ...(input.categoryId && { category_id: input.categoryId }),
        ...(input.categoryType && { category_type: input.categoryType }),
        ...(input.isDisabled !== undefined && { is_disabled: input.isDisabled }),
        ...(input.isFeatured !== undefined && { is_featured: input.isFeatured }),
        ...(input.isProminent !== undefined && { is_prominent: input.isProminent }),
        ...(input.image && { image: input.image }),
        ...(input.deleteImageUrl && { delete_image_url: input.deleteImageUrl }),
        ...(input.startDate && { start_date: new Date(input.startDate) }),
        ...(input.endDate && { end_date: new Date(input.endDate) }),
        ...(input.metaTitle && { meta_title: input.metaTitle }),
        ...(input.metaDescription && { meta_description: input.metaDescription }),
        ...(input.audience && input.audience.length > 0 && { audience: input.audience }),
        ...(input.tags && input.tags.length > 0 && { tags: input.tags }),
        ...(input.keywords && input.keywords.length > 0 && { keywords: input.keywords }),
        ...(input.schemaEnabled !== undefined && { schema_enabled: input.schemaEnabled }),
        ...(input.schemaMode && { schema_mode: input.schemaMode }),
        ...(input.schemaData && { schema_data: input.schemaData }),
        updated_by: "system",
    };
    return data;
}

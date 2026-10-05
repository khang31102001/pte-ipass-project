import { NewsDAO, NewsWithAuthorAndCategory, NewsWithAuthorName } from "@dao/news.dao";
import { DocumentDAO } from "@dao/document.dao";
import { Prisma, news } from "@prisma/client";
import slugify from "slugify";
import prisma from "@config/database";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";
import { ImgbbResponse, ImgbbService } from "@services/imgbb.service";
import { DeletedImageDAO } from "@dao/deletedImage.dao";

type newsJoinedDocument = {
    news: {
        id: number;
        image: string;
        title: string;
        description: string;
        content: string;
        category: string | null;
        authorName: string | null;
        authorAvatar: string | null;
    }[];
    tips: {
        id: number;
        image: string;
        title: string;
        description: string;
        content: string;
        category: string | null;
        authorName: string | null;
        authorAvatar: string | null;
    }[];
};

type NewsResponse = Omit<
    NewsWithAuthorAndCategory,
    "author_id" | "author_name" | "category_type"
> & {
    author: string | null;
    category_type: string | null;
};

export class NewsService {
    private newsDAO: NewsDAO;
    private documentDAO: DocumentDAO;
    private deletedImageDAO: DeletedImageDAO;

    constructor() {
        this.newsDAO = new NewsDAO();
        this.documentDAO = new DocumentDAO();
        this.deletedImageDAO = new DeletedImageDAO();
    }

    async getNewsById(id: number): Promise<NewsResponse | null> {
        const found = await this.newsDAO.findById(id);
        return toNewsResponse(found);
    }

    async getNewsAndTips(): Promise<newsJoinedDocument> {
        const news = this.newsDAO.findAll();
        const tips = this.documentDAO.findAll();

        const newsResult = await news;
        const tipsResult = await tips;
        return {
            news: newsResult,
            tips: tipsResult,
        };
    }

    async getAllNews(filters: {
        search?: string;
        title?: string;
        description?: string;
        slug?: string;
        status?: any;
        isProminent?: number;
        categoryId?: number;
        categoryType?: string;
        isFeatured?: boolean;
        isDisabled?: boolean;
        sortBy?: string,
        orderBy?: string,
        page: number;
        pageSize: number;
    }): Promise<{
        items: NewsResponse[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        const result = await this.newsDAO.findAllNews(filters);
        return {
            ...result,
            items: result.items
                .map((item) => toNewsResponse(item))
                .filter((item): item is NewsResponse => item !== null),
        };
    }

    async getNewsDetail(id?: number, slug?: string): Promise<NewsResponse | null> {
        let found: NewsWithAuthorName | null = null;
        if (id !== undefined) {
            found = await this.newsDAO.findById(id);
        } else if (slug !== undefined) {
            found = await this.newsDAO.findBySlug(slug);
        } else {
            throw new Error("Either id or slug must be provided.");
        }
        return toNewsResponse(found);
    }

    async createNews(input: SeoEvaluationInput, file?: Express.Multer.File) {
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
            console.log("Creating news with data:", JSON.stringify(data, null, 2));
            const created = await prisma.news.create({ data });
            return created;
        } catch (e: any) {
            console.error("Error creating news:", {
                code: e?.code,
                message: e?.message,
                meta: e?.meta,
                data: data,
            });
            if (e?.code === "P2002") {
                const field = e?.meta?.target?.[0] || "unknown";
                throw new Error(`NEWS_CONFLICT_${field}`);
            }
            throw e;
        }
    }

    async updateNews(
        id: number,
        data: Partial<SeoEvaluationInput>,
        file?: Express.Multer.File
    ): Promise<news> {
        const entity = await this.newsDAO.findById(id);
        if (!entity) {
            throw new Error("NEWS_NOT_FOUND");
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
            return await this.newsDAO.update(id, normalizedData);
        } catch (e: any) {
            if (e?.code === "P2025") {
                throw new Error("NEWS_NOT_FOUND");
            }
            throw e;
        }
    }

    async deleteNews(id: number): Promise<news> {
        const entity = await this.newsDAO.findById(id);
        if (!entity) {
            throw new Error("NEWS_NOT_FOUND");
        }
        if (entity.delete_image_url) {
            await this.deletedImageDAO.create(entity.delete_image_url);
        }
        return this.newsDAO.delete(id);
    }

    async deleteNewsByIds(ids: number[]): Promise<void> {
        try {
            const news = await prisma.news.findMany({
                where: { news_id: { in: ids } },
                select: { news_id: true, image: true, delete_image_url: true },
            });
            for (const n of news) {
                if (n.delete_image_url) {
                    await this.deletedImageDAO.create(n.delete_image_url);
                }
            }

            await this.newsDAO.deleteByIds(ids);
        } catch (e: any) {
            throw e;
        }
    }
}

function normalizeCreateInput(input: SeoEvaluationInput) {
    const data: Prisma.newsCreateInput = {
        slug: input.slug!,
        title: input.title,
        content: input.content!,
        ...(input.description && { description: input.description }),
        ...(input.level && { level: input.level as any }),
        ...(input.category && { category: input.category as any }),
        ...(input.categoryId && { category_id: input.categoryId }),
        ...(input.categoryType && { category_type: input.categoryType }),
        ...(input.isDisabled !== undefined && { is_disabled: input.isDisabled }),
        ...(input.isFeatured !== undefined && { is_featured: input.isFeatured }),
        ...(input.image && { image: input.image }),
        ...(input.deleteImageUrl && { delete_image_url: input.deleteImageUrl }),
        ...(input.content && { content: input.content }),
        ...(input.duration && { duration: input.duration }),
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
        ...(input.benefits && { benefits: input.benefits }),
        ...(input.tuition && { tuition: input.tuition }),
        ...(input.author !== undefined &&
            input.author !== null && {
                user: {
                    connect: { user_id: input.author },
                },
            }),
        created_by: "system",
        updated_by: "system",
        version: 1,
    };
    return data;
}

function normalizeUpdateInput(input: Partial<SeoEvaluationInput>) {
    const data: Partial<Prisma.newsUpdateInput> = {
        ...(input.slug && { slug: input.slug }),
        ...(input.title && { title: input.title }),
        ...(input.content && { content: input.content }),
        ...(input.description && { description: input.description }),
        ...(input.level && { level: input.level as any }),
        ...(input.category && { category: input.category as any }),
        ...(input.categoryId && { category_id: input.categoryId }),
        ...(input.categoryType && { category_type: input.categoryType }),
        ...(input.image && { image: input.image }),
        ...(input.content && { content: input.content }),
        ...(input.duration && { duration: input.duration }),
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
        ...(input.benefits && { benefits: input.benefits }),
        ...(input.tuition && { tuition: input.tuition }),
        ...(input.isDisabled !== undefined && { is_disabled: input.isDisabled }),
        ...(input.isFeatured !== undefined && { is_featured: input.isFeatured }),
        ...(input.isProminent !== undefined && { is_prominent: input.isProminent }),
        ...(input.status && { status: input.status as any }),
        updated_by: "system",
    };
    return data;
}

async function ensureUniqueSlug(base: string, newsIdToExclude?: number): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true, trim: true }) || "news";
    let candidate = baseSlug;
    let i = 1;
    while (true) {
        const found = await prisma.news.findFirst({
            where: {
                slug: candidate,
                ...(newsIdToExclude ? { news_id: { not: newsIdToExclude } } : {}),
            },
            select: { news_id: true },
        });
        if (!found) return candidate;
        i += 1;
        candidate = `${baseSlug}-${i}`;
    }
}

function replaceAuthorIdWithName(item: NewsWithAuthorName | null): NewsResponse | null {
    if (!item) return null;
    const { author_name, author_id, ...rest } = item as any;
    const resolvedName = author_name ?? null;
    return {
        ...rest,
        author: resolvedName,
    };
}

function toNewsResponse(item: NewsWithAuthorName | null): NewsResponse | null {
    const mapped = replaceAuthorIdWithName(item);
    if (!mapped) return null;
    return mapped;
}

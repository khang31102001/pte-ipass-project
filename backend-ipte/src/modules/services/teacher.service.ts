import { TeacherDAO } from "../dao/teacher.dao";
import { teacher, Prisma } from "@prisma/client";
import { AboutService } from "@services/about.service";
import slugify from "slugify";
import prisma from "@config/database";
import { ImgbbResponse, ImgbbService } from "@services/imgbb.service";
import { DeletedImageDAO } from "@dao/deletedImage.dao";

type TeacherResponse = {
    features: {
        icon: null;
        title: string;
        description: string;
    }[];
    data: {
        id: number;
        name: string;
        image: string;
        overallScore: string;
        listening: string;
        reading: string;
        speaking: string;
        writing: string;
    }[];
};

export type TeacherPayload = {
    userId?: number;
    bio?: string;
    name: string;
    image?: string | null;
    deleteImageUrl?: string | null;
    overallScore?: number;
    listeningScore?: number;
    speakingScore?: number;
    readingScore?: number;
    writingScore?: number;
    slug?: string;
    content?: string | null;
    seoScore?: number | null;
    createdBy?: string | null;
    updatedBy?: string | null;
    isImageChanged?: boolean;
};

export class TeacherService {
    private teacherDAO: TeacherDAO;
    private deletedImageDAO: DeletedImageDAO;

    constructor() {
        this.teacherDAO = new TeacherDAO();
        this.deletedImageDAO = new DeletedImageDAO();
    }

    async getTeacherById(id: number): Promise<teacher> {
        const found = await this.teacherDAO.findById(id);
        if (!found) {
            throw new Error("TEACHER_NOT_FOUND");
        }
        return found;
    }

    async getAllTeachers(): Promise<TeacherResponse> {
        const teachers = await this.teacherDAO.findAll();

        const teachersData = teachers.map((teacher) => ({
            id: teacher.teacher_id,
            name: teacher.name,
            image: teacher.image ?? "",
            overallScore: teacher.overall_score?.toString() ?? "",
            listening: teacher.listening_score?.toString() ?? "",
            reading: teacher.reading_score?.toString() ?? "",
            speaking: teacher.speaking_score?.toString() ?? "",
            writing: teacher.writing_score?.toString() ?? "",
        }));

        const teacherfeatures = await AboutService.list({
            category: "TEACHER",
        });

        const teacherfeaturesData = teacherfeatures.items.map((feature) => ({
            icon: null,
            title: feature.title?.toString() ?? "",
            description: feature.description?.toString() ?? "",
        }));

        return {
            features: teacherfeaturesData,
            data: teachersData,
        };
    }

    async createTeacher(input: TeacherPayload, file?: Express.Multer.File): Promise<teacher> {
        const desiredSlug = input.slug || input.name;
        const uniqueSlug = await ensureUniqueTeacherSlug(desiredSlug);

        let imgbbResponse: ImgbbResponse | undefined;
        try {
            imgbbResponse = await ImgbbService.uploadFromInput(null, file, {
                fileName: uniqueSlug,
            });
        } catch (e: any) {
            console.error("Error uploading teacher image:", e?.message || e);
            throw new Error(`IMAGE_UPLOAD_FAILED: ${e?.message || "UNKNOWN"}`);
        }

        const data = normalizeCreateInput({
            ...input,
            slug: uniqueSlug,
            image: imgbbResponse?.data?.display_url ?? input.image ?? null,
            deleteImageUrl: imgbbResponse?.data?.delete_url ?? input.deleteImageUrl ?? null,
        });

        try {
            const created = await this.teacherDAO.create(data);
            return created;
        } catch (e: any) {
            console.error("Error creating teacher:", {
                code: e?.code,
                message: e?.message,
                meta: e?.meta,
                data: data,
            });
            if (e?.code === "P2002") {
                throw new Error("TEACHER_CONFLICT");
            }
            throw e;
        }
    }

    async updateTeacher(
        id: number,
        input: Partial<TeacherPayload>,
        file?: Express.Multer.File
    ): Promise<teacher> {
        const existing = await this.teacherDAO.findById(id);
        if (!existing) {
            throw new Error("TEACHER_NOT_FOUND");
        }

        const desiredSlug = input.slug || input.name || existing.name || existing.slug;
        const uniqueSlug = await ensureUniqueTeacherSlug(desiredSlug, id);

        let imgbbResponse: ImgbbResponse | undefined;
        if (input.isImageChanged && file) {
            try {
                imgbbResponse = await ImgbbService.uploadFromInput(null, file, {
                    fileName: uniqueSlug,
                });
            } catch (e: any) {
                console.error("Error uploading teacher image:", e?.message || e);
                throw new Error(`IMAGE_UPLOAD_FAILED: ${e?.message || "UNKNOWN"}`);
            }
        }

        let image = input.image;
        let deleteImageUrl = input.deleteImageUrl;
        if (imgbbResponse) {
            image = imgbbResponse?.data?.display_url;
            deleteImageUrl = imgbbResponse?.data?.delete_url;
        }

        const data = normalizeUpdateInput({
            ...input,
            slug: uniqueSlug,
            image: image ?? existing.image,
            deleteImageUrl: deleteImageUrl ?? existing.delete_image_url,
        });

        try {
            if (existing.delete_image_url) {
                await this.deletedImageDAO.create(existing.delete_image_url);
            }
            return await this.teacherDAO.update(id, data);
        } catch (e: any) {
            if (e?.code === "P2025") {
                throw new Error("TEACHER_NOT_FOUND");
            }
            if (e?.code === "P2002") {
                throw new Error("TEACHER_CONFLICT");
            }
            throw e;
        }
    }

    async deleteTeacher(id: number): Promise<void> {
        const teacher = await this.teacherDAO.findById(id);
        if (!teacher) {
            throw new Error("TEACHER_NOT_FOUND");
        }

        if (teacher.delete_image_url) {
            await this.deletedImageDAO.create(teacher.delete_image_url);
        }

        try {
            await this.teacherDAO.delete(id);
        } catch (e: any) {
            if (e?.code === "P2025") {
                throw new Error("TEACHER_NOT_FOUND");
            }
            throw e;
        }
    }

    async deleteTeachersByIds(ids: number[]): Promise<void> {
        const teachers = await prisma.teacher.findMany({
            where: { teacher_id: { in: ids } },
            select: { teacher_id: true, delete_image_url: true },
        });

        for (const teacher of teachers) {
            if (teacher.delete_image_url) {
                await this.deletedImageDAO.create(teacher.delete_image_url);
            }
        }

        await this.teacherDAO.deleteByIds(ids);
    }

    async getTeachers(filters: {
        name?: string;
        slug?: string;
        overallScore?: number;
        listeningScore?: number;
        speakingScore?: number;
        readingScore?: number;
        writingScore?: number;
        page: number;
        pageSize: number;
    }): Promise<{ items: teacher[]; page: number; page_size: number; total: number; total_pages: number }> {
        return this.teacherDAO.findWithFilters(filters);
    }

    async getTeacherDetail(id?: number, slug?: string): Promise<teacher> {
        let teacher: teacher | null = null;
        if (id !== undefined) {
            teacher = await this.teacherDAO.findById(id);
        } else if (slug !== undefined) {
            teacher = await this.teacherDAO.findBySlug(slug);
        } else {
            throw new Error("Either id or slug must be provided.");
        }

        if (!teacher) {
            throw new Error("TEACHER_NOT_FOUND");
        }
        return teacher;
    }
}

function normalizeCreateInput(
    input: TeacherPayload & { slug: string; image?: string | null; deleteImageUrl?: string | null }
) {
    const data: Prisma.teacherUncheckedCreateInput = {
        name: input.name,
        slug: input.slug,
        ...(input.bio && { bio: input.bio }),
        ...(input.userId && { user_id: input.userId }),
        ...(input.image && { image: input.image }),
        ...(input.deleteImageUrl && { delete_image_url: input.deleteImageUrl }),
        ...(input.overallScore !== undefined && { overall_score: input.overallScore }),
        ...(input.listeningScore !== undefined && { listening_score: input.listeningScore }),
        ...(input.speakingScore !== undefined && { speaking_score: input.speakingScore }),
        ...(input.readingScore !== undefined && { reading_score: input.readingScore }),
        ...(input.writingScore !== undefined && { writing_score: input.writingScore }),
        ...(input.content && { content: input.content }),
        ...(input.seoScore !== undefined && { seo_score: input.seoScore }),
        created_by: input.createdBy || "system",
        updated_by: input.updatedBy || "system",
        version: 1,
    };
    return data;
}

function normalizeUpdateInput(
    input: Partial<TeacherPayload> & {
        slug: string;
        image?: string | null | undefined;
        deleteImageUrl?: string | null | undefined;
    }
) {
    const data: Prisma.teacherUncheckedUpdateInput = {
        ...(input.name && { name: input.name }),
        ...(input.slug && { slug: input.slug }),
        ...(input.bio && { bio: input.bio }),
        ...(input.userId && { user_id: input.userId }),
        ...(input.image !== undefined && { image: input.image }),
        ...(input.deleteImageUrl !== undefined && { delete_image_url: input.deleteImageUrl }),
        ...(input.overallScore !== undefined && { overall_score: input.overallScore }),
        ...(input.listeningScore !== undefined && { listening_score: input.listeningScore }),
        ...(input.speakingScore !== undefined && { speaking_score: input.speakingScore }),
        ...(input.readingScore !== undefined && { reading_score: input.readingScore }),
        ...(input.writingScore !== undefined && { writing_score: input.writingScore }),
        ...(input.content && { content: input.content }),
        ...(input.seoScore !== undefined && { seo_score: input.seoScore }),
        updated_at: new Date(),
        updated_by: input.updatedBy || "system",
        version: { increment: 1 },
    };
    return data;
}

async function ensureUniqueTeacherSlug(base: string, teacherIdToExclude?: number): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true, trim: true }) || "teacher";
    let candidate = baseSlug;
    let i = 1;
    while (true) {
        const found = await prisma.teacher.findFirst({
            where: {
                slug: candidate,
                ...(teacherIdToExclude ? { teacher_id: { not: teacherIdToExclude } } : {}),
            },
            select: { teacher_id: true },
        });
        if (!found) return candidate;
        i += 1;
        candidate = `${baseSlug}-${i}`;
    }
}

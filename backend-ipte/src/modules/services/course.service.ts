import prisma from "@config/database";
import { $Enums, Prisma } from "@prisma/client";
import slugify from "slugify";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";
import { ImgbbResponse, ImgbbService } from "@services/imgbb.service";
import { DeletedImageDAO } from "@dao/deletedImage.dao";
import { CategoryDAO } from "@dao/category.dao";

export type CourseUpdateDTO = Partial<SeoEvaluationInput>;

export type CourseListQuery = {
    q?: string; // search
    courseName?: string;
    title?: string;
    description?: string;
    schedule?: string;
    tuition?: string;
    slug?: string;
    category?: string;
    categoryId?: number;
    categoryType?: string;
    isFeatured?: boolean;
    isDisabled?: boolean;
    sortBy?: "price" | "created_at" | "updated_at";
    orderBy?: "asc" | "desc";
    page?: number;
    pageSize?: number;
};

export const COURSE_LIST_FIELDS = {
  course_id: true,
  course_code: true,
  course_name: true,
  slug: true,
  title: true,
  description: true,

  level: true,
  mode: true,
  language: true,

  price: true,
  duration: true,
  start_date: true,
  end_date: true,

  image: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,

//   version: true,
  category: true,
  category_id: true,
  category_type: true,

  schedule: true,
  tuition: true,

  is_featured: true,
  is_disabled: true,

//   meta_title: true,
//   meta_description: true,

//   audience: true,
//   keywords: true,

//   schema_enabled: true,
//   schema_mode: true,
//   content: true
//   benefits: true,
//   seo_score: true,
//   delete_image_url: true,
};
async function ensureUniqueSlug(base: string, courseIdToExclude?: number): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true, trim: true }) || "course";
    let candidate = baseSlug;
    let i = 1;
    while (true) {
        const found = await prisma.course.findFirst({
            where: {
                slug: candidate,
                ...(courseIdToExclude ? { course_id: { not: courseIdToExclude } } : {}),
            },
            select: { course_id: true },
        });
        if (!found) return candidate;
        i += 1;
        candidate = `${baseSlug}-${i}`;
    }
}

function normalizeCreateInput(input: SeoEvaluationInput) {
    const data: Prisma.courseCreateInput = {
        course_name: input.title,
        slug: input.slug!,
        title: input.title,
        ...(input.description && { description: input.description }),
        ...(input.level && { level: input.level as any }),
        ...(input.category && { category: input.category as any }),
        ...(input.categoryId && { category_id: input.categoryId }),
        ...(input.categoryType && { category_type: input.categoryType }),
        is_disabled: input.isDisabled ? input.isDisabled : false,
        is_featured: input.isFeatured ? input.isFeatured : false,
        ...(input.image && { image: input.image }),
        ...(input.content && { content: input.content }),
        ...(input.duration && { duration: input.duration }),
        ...(input.startDate && { start_date: new Date(input.startDate) }),
        ...(input.endDate && { end_date: new Date(input.endDate) }),
        ...(input.metaTitle && { meta_title: input.metaTitle }),
        ...(input.metaDescription && { meta_description: input.metaDescription }),
        ...(input.audience && input.audience.length > 0 && { audience: input.audience }),
        ...(input.keywords && input.keywords.length > 0 && { keywords: input.keywords }),
        ...(input.schemaEnabled !== undefined && { schema_enabled: input.schemaEnabled }),
        ...(input.schemaMode && { schema_mode: input.schemaMode }),
        ...(input.schemaData && { schema_data: input.schemaData }),
        ...(input.benefits && { benefits: input.benefits }),
        ...(input.tuition && { tuition: input.tuition }),
        created_by: "system",
        updated_by: "system",
        version: 1,
    };
    return data;
}

function normalizeUpdateInput(input: CourseUpdateDTO) {
    const data: Prisma.courseUpdateInput = {
        ...(input.title && { course_name: input.title, title: input.title }),
        ...(input.description && { description: input.description }),
        ...(input.level && { level: input.level as any }),
        ...(input.category && { category: input.category as any }),
        ...(input.categoryType && { category_type: input.categoryType as any }),
        ...(input.categoryId && { category_id: input.categoryId }),
        ...(input.isDisabled !== undefined && { is_disabled: input.isDisabled }),
        ...(input.isFeatured !== undefined && { is_featured: input.isFeatured }),
        ...(input.image && { image: input.image }),
        ...(input.content && { content: input.content }),
        ...(input.duration && { duration: input.duration }),
        ...(input.startDate && { start_date: new Date(input.startDate) }),
        ...(input.endDate && { end_date: new Date(input.endDate) }),
        ...(input.metaTitle && { meta_title: input.metaTitle }),
        ...(input.metaDescription && { meta_description: input.metaDescription }),
        ...(input.audience && input.audience.length > 0 && { audience: input.audience }),
        ...(input.keywords && input.keywords.length > 0 && { keywords: input.keywords }),
        ...(input.schemaEnabled !== undefined && { schema_enabled: input.schemaEnabled }),
        ...(input.schemaMode && { schema_mode: input.schemaMode }),
        ...(input.schemaData && { schema_data: input.schemaData }),
        ...(input.benefits && { benefits: input.benefits }),
        ...(input.tuition && { tuition: input.tuition }),
        updated_at: new Date(),
        updated_by: "system",
        version: { increment: 1 },
    };
    return data;
}

export class CourseService {
    static async createCourse(input: SeoEvaluationInput, file?: Express.Multer.File) {
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
            const created = await prisma.course.create({ data });
            return created;
        } catch (e: any) {
            console.error("Error creating course:", {
                code: e?.code,
                message: e?.message,
                meta: e?.meta,
                data: data,
            });
            if (e?.code === "P2002") {
                const field = e?.meta?.target?.[0] || "unknown";
                throw new Error(`COURSE_CONFLICT_${field}`);
            }
            throw e;
        }
    }

    static async getCourseById(courseId: number) {
        const found = await prisma.course.findUnique({
            where: { course_id: courseId },
        });
        if (!found) throw new Error("COURSE_NOT_FOUND");

        return found;
    }

    static async listCourses(query: CourseListQuery) {
        const {
            q,
            courseName,
            title,
            description,
            schedule,
            tuition,
            slug,
            category,
            categoryId,
            categoryType,
            isFeatured,
            isDisabled,
            sortBy: sort_by = "created_at",
            orderBy: sort_order = "desc",
            page,
            pageSize,
        } = query;

        let categoryIdList: number[] | undefined;

        if (categoryId) {
            categoryIdList = await new CategoryDAO().findAllCategoryIdsDeepByParentId(categoryId);
        }

        const where: Prisma.courseWhereInput = {
            AND: [
                q
                    ? {
                          OR: [
                              {
                                  course_name: {
                                      contains: q,
                                      mode: "insensitive",
                                  },
                              },
                              {
                                  course_code: {
                                      contains: q,
                                      mode: "insensitive",
                                  },
                              },
                              { slug: { contains: q, mode: "insensitive" } },
                          ],
                      }
                    : {},
                courseName
                    ? {
                          course_name: {
                              contains: courseName,
                              mode: "insensitive",
                          },
                      }
                    : {},
                title
                    ? {
                          title: {
                              contains: title,
                              mode: "insensitive",
                          },
                      }
                    : {},
                description
                    ? {
                          description: {
                              contains: description,
                              mode: "insensitive",
                          },
                      }
                    : {},
                schedule
                    ? {
                          schedule: {
                              contains: schedule,
                              mode: "insensitive",
                          },
                      }
                    : {},
                tuition
                    ? {
                          tuition: {
                              contains: tuition,
                              mode: "insensitive",
                          },
                      }
                    : {},
                category
                    ? {
                          category: {
                              equals: category as $Enums.course_category,
                          },
                      }
                    : {},
                categoryType
                    ? {
                          category_type: { equals: categoryType },
                      }
                    : {},
                slug ? { slug: { equals: slug } } : {},
                isFeatured !== undefined ? { is_featured: { equals: isFeatured } } : {},
                isDisabled !== undefined ? { is_disabled: { equals: isDisabled } } : {},
                categoryIdList
                    ? {
                        category_id: {
                            in: categoryIdList,
                        },
                    }
                    : {},
            ],
        };

        const orderBy: Prisma.courseOrderByWithRelationInput = {
            [sort_by]: sort_order,
        } as Prisma.courseOrderByWithRelationInput;

        const skip = (Math.max(1, page || 1) - 1) * Math.max(1, pageSize || 20);
        const take = Math.max(1, Math.min(pageSize || 20, 100));

        const [items, total] = await Promise.all([
            prisma.course.findMany({ where, orderBy, skip, take, select: COURSE_LIST_FIELDS }),
            prisma.course.count({ where }),
        ]);

        return {
            items,
            page: Math.max(1, page || 1),
            pageSize: take,
            total,
            total_pages: Math.ceil(total / take),
        };
    }

    static async updateCourse(
        courseId: number,
        input: CourseUpdateDTO,
        file?: Express.Multer.File
    ) {
        const entity = await this.getCourseById(courseId);
        if (!entity) {
            throw new Error("COURSE_NOT_FOUND");
        }
        if (input.slug || input.title) {
            const base = input.slug || input.title!;
            const uniqueSlug = await ensureUniqueSlug(base, courseId);
            input.slug = uniqueSlug;
        }

        let imgbbResponse: ImgbbResponse | undefined;
        if (input.isImageChanged && file) {
            try {
                imgbbResponse = await ImgbbService.uploadFromInput(null, file, {
                    fileName: input.slug || input.title,
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
            ...input,
            image: image ?? entity.image,
            deleteImageUrl: deleteImageUrl ?? entity.delete_image_url,
        });

        try {
            if (entity?.delete_image_url) {
                await new DeletedImageDAO().create(entity.delete_image_url);
            }
            const updated = await prisma.course.update({
                where: { course_id: courseId },
                data: normalizedData,
            });
            return updated;
        } catch (e: any) {
            if (e?.code === "P2002") throw new Error("COURSE_CONFLICT");
            if (e?.code === "P2025") throw new Error("COURSE_NOT_FOUND");
            throw e;
        }
    }

    static async deleteCourse(courseId: number) {
        try {
            const course = await prisma.course.findUnique({
                where: { course_id: courseId },
                select: { image: true, delete_image_url: true },
            });
            if (!course) throw new Error("COURSE_NOT_FOUND");

            if (course.delete_image_url) {
                await new DeletedImageDAO().create(course.delete_image_url);
            }

            await prisma.course.delete({ where: { course_id: courseId } });
        } catch (e: any) {
            if (e?.code === "P2025") throw new Error("COURSE_NOT_FOUND");
            throw e;
        }
    }

    static async deleteCourseByIds(courseIds: number[]) {
        try {
            const courses = await prisma.course.findMany({
                where: { course_id: { in: courseIds } },
                select: { course_id: true, image: true, delete_image_url: true },
            });
            for (const course of courses) {
                if (course.delete_image_url) {
                    await new DeletedImageDAO().create(course.delete_image_url);
                }
            }

            await prisma.course.deleteMany({
                where: { course_id: { in: courseIds } },
            });
        } catch (e: any) {
            throw e;
        }
    }

    static async getCourseBySlug(slug: string) {
        const found = await prisma.course.findUnique({ where: { slug } });
        if (!found) throw new Error("COURSE_NOT_FOUND");
        return found;
    }

    static async getCourseDetail(id?: number, slug?: string) {
        let course;
        if (id !== undefined) {
            course = await this.getCourseById(id);
        } else if (slug !== undefined) {
            course = await this.getCourseBySlug(slug);
        } else {
            throw new Error("Either id or slug must be provided.");
        }
        return course;
    }
}

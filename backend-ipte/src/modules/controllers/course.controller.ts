import { Request, Response } from "express";
import { CourseService } from "@services/course.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

export class CourseController {
    async create(req: Request, res: Response) {
        let payload: SeoEvaluationInput;
        try {
            payload = parseJsonField<SeoEvaluationInput>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const { course_id, courseId, ...data } = payload as any;
            const created = await CourseService.createCourse(data, req.file);
            await revalidate([TAGS.COURSES]);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (e: any) {
            if (e?.message === "COURSE_CONFLICT") {
                return res.status(409).json({ message: "Course code or slug already exists." });
            }
            return res.status(500).json({ message: "Failed to create course." });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid course id." });

            const course = await CourseService.getCourseById(id);
            res.json(camelCaseKeysDeep(course));
        } catch (e: any) {
            if (e?.message === "COURSE_NOT_FOUND") {
                return res.status(404).json({ message: "Course not found." });
            }
            return res.status(500).json({ message: "Failed to get course." });
        }
    }

    async list(req: Request, res: Response) {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));
            const {
                search: q,
                courseName,
                slug,
                title,
                description,
                schedule,
                tuition,
                category,
                categoryId,
                categoryType,
                isFeatured,
                isDisabled,
                orderBy,
                sortBy,
            } = req.query;

            const result = await CourseService.listCourses({
                q: q as string | undefined,
                courseName: courseName as string | undefined,
                title: title as string | undefined,
                description: description as string | undefined,
                schedule: schedule as string | undefined,
                tuition: tuition as string | undefined,
                slug: slug as string | undefined,
                category: category as string | undefined,
                categoryId: categoryId != null ? Number(categoryId) : undefined,
                categoryType: categoryType as string | undefined,
                isFeatured: isFeatured != null ? isFeatured === "true" : undefined,
                isDisabled: isDisabled != null ? isDisabled === "true" : undefined,
                orderBy: orderBy as "asc" | "desc" | undefined,
                sortBy: sortBy as "price" | "created_at" | "updated_at" | undefined,
                page,
                pageSize,
            });

            res.json(camelCaseKeysDeep(result));
        } catch (e: any) {
            return res.status(500).json({ message: "Failed to list courses." });
        }
    }

    async update(req: Request, res: Response) {
        let payload: Partial<SeoEvaluationInput>;
        try {
            payload = parseJsonField<Partial<SeoEvaluationInput>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const id = Number(req.params.id);
            if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid course id." });

            const updated = await CourseService.updateCourse(id, payload, req.file);
            await revalidate([updated.slug ? TAGS.detail(updated.slug) : TAGS.COURSES]);
            res.json(camelCaseKeysDeep(updated));
        } catch (e: any) {
            if (e?.message === "COURSE_NOT_FOUND") {
                return res.status(404).json({ message: "Course not found." });
            }
            if (e?.message === "COURSE_CONFLICT") {
                return res.status(409).json({ message: "Course code or slug already exists." });
            }
            return res.status(500).json({ message: "Failed to update course." });
        }
    }

    async remove(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid course id." });

            await CourseService.deleteCourse(id);
            await revalidate([TAGS.COURSES]);
            res.status(204).end();
        } catch (e: any) {
            if (e?.message === "COURSE_NOT_FOUND") {
                return res.status(404).json({ message: "Course not found." });
            }
            return res.status(500).json({ message: "Failed to delete course." });
        }
    }

    async deleteCourseByIds(req: Request, res: Response) {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number")) {
                return res.status(400).json({ message: "Invalid course ids." });
            }

            await CourseService.deleteCourseByIds(ids);
            await revalidate([TAGS.COURSES]);
            res.status(204).end();
        } catch (e: any) {
            return res.status(500).json({ message: "Failed to delete courses." });
        }
    }

    async getBySlug(req: Request, res: Response) {
        try {
            const slug = req.params.slug;
            const course = await CourseService.getCourseBySlug(slug);
            res.json(camelCaseKeysDeep(course));
        } catch (e: any) {
            if (e?.message === "COURSE_NOT_FOUND") {
                return res.status(404).json({ message: "Course not found." });
            }
            return res.status(500).json({ message: "Failed to get course." });
        }
    }

    async getCourseDetail(req: Request, res: Response) {
        try {
            const { id, slug } = req.query;
            const courseDetail = await CourseService.getCourseDetail(
                id ? Number(id) : undefined,
                slug ? String(slug) : undefined
            );
            res.status(200).json(camelCaseKeysDeep(courseDetail));
        } catch (e: any) {
            if (e?.message === "COURSE_NOT_FOUND") {
                return res.status(404).json({ message: "Course not found." });
            }
            return res.status(500).json({ message: "Failed to get course." });
        }
    }
}

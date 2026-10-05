import { Request, Response } from "express";
import { TeacherService } from "@services/teacher.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { revalidate } from "@services/revalidate.service";

const teacherService = new TeacherService();

export class TeacherController {
    async createTeacher(req: Request, res: Response): Promise<void> {
        let payload: any;
        try {
            payload = parseJsonField<any>(req);
        } catch {
            res.status(400).json({ message: "Invalid request payload." });
            return;
        }
        try {
            const { teacher_id, teacherId, id, ...data } = payload as any;
            const created = await teacherService.createTeacher(data, req.file);
            await revalidate(["teachers"]);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (error: any) {
            if (error?.message === "TEACHER_CONFLICT") {
                res.status(409).json({ message: "Teacher slug already exists." });
                return;
            }
            res.status(500).json({
                message: "Failed to create teacher",
                error: error.message,
            });
        }
    }

    async getTeachers(req: Request, res: Response): Promise<void> {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));
            const {
                search,
                name,
                slug,
                overallScore,
                listeningScore,
                speakingScore,
                readingScore,
                writingScore,
            } = req.query;
            const teachers = await teacherService.getTeachers({
                name: (name || search) as string | undefined,
                slug: slug as string | undefined,
                overallScore: overallScore ? Number(overallScore) : undefined,
                listeningScore: listeningScore ? Number(listeningScore) : undefined,
                speakingScore: speakingScore ? Number(speakingScore) : undefined,
                readingScore: readingScore ? Number(readingScore) : undefined,
                writingScore: writingScore ? Number(writingScore) : undefined,
                page,
                pageSize,
            });
            res.status(200).json(camelCaseKeysDeep(teachers));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch users",
                error: error.message,
            });
        }
    }

    async getTeacherById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            if (Number.isNaN(id)) {
                res.status(400).json({ message: "Invalid teacher_id." });
                return;
            }
            const teacher = await teacherService.getTeacherById(id);
            res.status(200).json(camelCaseKeysDeep(teacher));
        } catch (error: any) {
            if (error?.message === "TEACHER_NOT_FOUND") {
                res.status(404).json({ message: "Teacher not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to fetch teacher",
                error: error.message,
            });
        }
    }

    async getTeacherDetail(req: Request, res: Response): Promise<void> {
        const { id, slug } = req.query;
        if (id && Number.isNaN(Number(id))) {
            res.status(400).json({ message: "Invalid teacher_id." });
            return;
        }
        try {
            const teacher = await teacherService.getTeacherDetail(
                id ? Number(id) : undefined,
                slug ? String(slug) : undefined
            );
            res.status(200).json(camelCaseKeysDeep(teacher));
        } catch (error: any) {
            if (error?.message === "TEACHER_NOT_FOUND") {
                res.status(404).json({ message: "Teacher not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to fetch teacher",
                error: error.message,
            });
        }
    }

    async updateTeacher(req: Request, res: Response): Promise<void> {
        let payload: any;
        try {
            payload = parseJsonField<any>(req);
        } catch {
            res.status(400).json({ message: "Invalid request payload." });
            return;
        }
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid teacher_id." });
            return;
        }
        try {
            const updated = await teacherService.updateTeacher(id, payload, req.file);
            await revalidate(["teachers"]);
            res.status(200).json(camelCaseKeysDeep(updated));
        } catch (error: any) {
            if (error?.message === "TEACHER_NOT_FOUND") {
                res.status(404).json({ message: "Teacher not found." });
                return;
            }
            if (error?.message === "TEACHER_CONFLICT") {
                res.status(409).json({ message: "Teacher slug already exists." });
                return;
            }
            res.status(500).json({
                message: "Failed to update teacher",
                error: error.message,
            });
        }
    }

    async deleteTeacher(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid teacher_id." });
            return;
        }
        try {
            await teacherService.deleteTeacher(id);
            await revalidate(["teachers"]);
            res.status(204).end();
        } catch (error: any) {
            if (error?.message === "TEACHER_NOT_FOUND") {
                res.status(404).json({ message: "Teacher not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to delete teacher",
                error: error.message,
            });
        }
    }

    async deleteTeachersByIds(req: Request, res: Response): Promise<void> {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number")) {
                res.status(400).json({ message: "Invalid teacher ids." });
                return;
            }

            await teacherService.deleteTeachersByIds(ids);
            await revalidate(["teachers"]);
            res.status(204).end();
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to delete teachers",
                error: error.message,
            });
        }
    }
}

import { Request, Response } from "express";

import { StudentService } from "@services/student.service";
import { camelCaseKeysDeep } from "@utils/response";

const studentService = new StudentService();

export class StudentController {
    async createStudent(req: Request, res: Response): Promise<void> {
        try {
            const { student_id, studentId, id, ...data } = req.body;
            const created = await studentService.createStudent(data);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to create student",
                error: error.message,
            });
        }
    }

    async getStudents(req: Request, res: Response): Promise<void> {
        try {
            const page = req.query.page ? Number(req.query.page) : 1;
            const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
            const { fullName, slug, phone, courseId } = req.query;

            const students = await studentService.getStudents({
                fullName: fullName as string | undefined,
                slug: slug as string | undefined,
                phone: phone as string | undefined,
                courseId: courseId ? Number(courseId) : undefined,
                page,
                pageSize,
            });

            res.status(200).json(camelCaseKeysDeep(students));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch students",
                error: error.message,
            });
        }
    }

    async getStudentDetail(req: Request, res: Response): Promise<void> {
        const { id, slug } = req.query;
        if (id && Number.isNaN(Number(id))) {
            res.status(400).json({ message: "Invalid student_id." });
            return;
        }
        try {
            const student = await studentService.getStudentDetail(
                id ? Number(id) : undefined,
                slug ? String(slug) : undefined
            );
            if (!student) {
                res.status(404).json({ message: "Student not found." });
                return;
            }
            res.status(200).json(camelCaseKeysDeep(student));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch student",
                error: error.message,
            });
        }
    }

    async updateStudent(req: Request, res: Response): Promise<void> {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            res.status(400).json({ message: "Invalid student_id." });
            return;
        }
        try {
            const updated = await studentService.updateStudent(id, req.body);
            res.status(200).json(camelCaseKeysDeep(updated));
        } catch (error: any) {
            if (error?.message === "STUDENT_NOT_FOUND") {
                res.status(404).json({ message: "Student not found." });
                return;
            }
            res.status(500).json({
                message: "Failed to update student",
                error: error.message,
            });
        }
    }
}

import { Prisma, student } from "@prisma/client";
import slugify from "slugify";

import prisma from "@config/database";
import { StudentDAO } from "@dao/student.dao";

type CreateStudentInput = {
    userId?: number;
    phone?: string;
    dob?: string | Date;
    address?: string;
    note?: string;
    fullName: string;
    courseId?: number;
    slug?: string;
    createdBy?: string | null;
    updatedBy?: string | null;
};

export class StudentService {
    private studentDAO: StudentDAO;

    constructor() {
        this.studentDAO = new StudentDAO();
    }

    async createStudent(input: CreateStudentInput): Promise<student> {
        const desiredSlug = input.slug || input.fullName;
        const uniqueSlug = await ensureUniqueStudentSlug(desiredSlug);

        const data = normalizeCreateInput({ ...input, slug: uniqueSlug });
        return this.studentDAO.create(data);
    }

    async getStudents(filters: {
        fullName?: string;
        slug?: string;
        phone?: string;
        courseId?: number;
        page: number;
        pageSize: number;
    }) {
        return this.studentDAO.findWithFilters(filters);
    }

    async updateStudent(id: number, input: Partial<CreateStudentInput>): Promise<student> {
        const existing = await this.studentDAO.findById(id);
        if (!existing) {
            throw new Error("STUDENT_NOT_FOUND");
        }

        const desiredSlug = input.slug || input.fullName || existing.full_name || existing.slug;
        const uniqueSlug = await ensureUniqueStudentSlug(desiredSlug, id);

        const data = normalizeUpdateInput({ ...input, slug: uniqueSlug });
        return this.studentDAO.update(id, data);
    }

    async getStudentDetail(id?: number, slug?: string): Promise<student | null> {
        if (id !== undefined) {
            return this.studentDAO.findById(id);
        } else if (slug !== undefined) {
            return this.studentDAO.findBySlug(slug);
        } else {
            throw new Error("Either id or slug must be provided.");
        }
    }
}

function normalizeCreateInput(input: CreateStudentInput & { slug: string }) {
    const data: Prisma.studentUncheckedCreateInput = {
        full_name: input.fullName,
        slug: input.slug,
        ...(input.userId && { user_id: input.userId }),
        ...(input.phone && { phone: input.phone }),
        ...(input.dob && { dob: new Date(input.dob) }),
        ...(input.address && { address: input.address }),
        ...(input.note && { note: input.note }),
        ...(input.courseId && { course_id: input.courseId }),
        created_by: input.createdBy || "system",
        updated_by: input.updatedBy || "system",
        version: 1,
    };
    return data;
}

function normalizeUpdateInput(input: Partial<CreateStudentInput> & { slug: string }) {
    const data: Prisma.studentUncheckedUpdateInput = {
        ...(input.fullName && { full_name: input.fullName }),
        ...(input.slug && { slug: input.slug }),
        ...(input.userId && { user_id: input.userId }),
        ...(input.phone && { phone: input.phone }),
        ...(input.dob && { dob: new Date(input.dob) }),
        ...(input.address && { address: input.address }),
        ...(input.note && { note: input.note }),
        ...(input.courseId && { course_id: input.courseId }),
        updated_at: new Date(),
        updated_by: input.updatedBy || "system",
        version: { increment: 1 },
    };
    return data;
}

async function ensureUniqueStudentSlug(base: string, studentIdToExclude?: number): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true, trim: true }) || "student";
    let candidate = baseSlug;
    let i = 1;
    while (true) {
        const found = await prisma.student.findFirst({
            where: {
                slug: candidate,
                ...(studentIdToExclude ? { student_id: { not: studentIdToExclude } } : {}),
            },
            select: { student_id: true },
        });
        if (!found) return candidate;
        i += 1;
        candidate = `${baseSlug}-${i}`;
    }
}

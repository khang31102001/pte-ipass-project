import { Prisma, consultation } from "@prisma/client";

import { ConsultationDAO } from "@dao/consultation.dao";
import { ConsultationDTO } from "@dto/ConsultationDTO";
import { config } from "@config/index";
import { sendMail } from "@utils/mailer";
import { UserDAO } from "@dao/user.dao";

type ConsultationListQuery = {
    q?: string;
    status?: string;
    courseId?: number;
    page?: number;
    page_size?: number;
};

export class ConsultationService {
    private consultationDAO: ConsultationDAO;
    private userDAO: UserDAO;

    constructor() {
        this.consultationDAO = new ConsultationDAO();
        this.userDAO = new UserDAO();
    }

    async createConsultationRequest(payload: Partial<ConsultationDTO>) {
        const data: Prisma.consultationUncheckedCreateInput = {
            name: payload.name || "",
            email: payload.email || "",
            ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
            ...(payload.courseId !== undefined ? { course_id: payload.courseId } : {}),
            ...(payload.message !== undefined ? { message: payload.message } : {}),
            ...(payload.status !== undefined ? { status: payload.status } : {}),
            ...(payload.targetScore !== undefined ? { target_score: payload.targetScore } : {}),
            created_by: payload.createdBy || "system",
            updated_by: payload.updatedBy || "system",
            version: payload.version ?? 1,
        };

        const created = await this.consultationDAO.create(data);

        this.notifyAdmin(created).catch((err) => {
            console.error("Failed to send consultation notification email:", err?.message || err);
        });

        return created;
    }

    async getById(id: number) {
        const found = await this.consultationDAO.findById(id);
        if (!found) throw new Error("CONSULTATION_NOT_FOUND");
        return found;
    }

    async list(query: ConsultationListQuery) {
        const page = Math.max(1, query.page || 1);
        const pageSize = Math.max(1, Math.min(query.page_size || 20, 100));

        return this.consultationDAO.findWithFilters({
            q: query.q,
            status: query.status,
            courseId: query.courseId,
            page,
            pageSize,
        });
    }

    async updateConsultation(id: number, payload: Partial<ConsultationDTO>) {
        const existing = await this.consultationDAO.findById(id);
        if (!existing) throw new Error("CONSULTATION_NOT_FOUND");

        const data: Prisma.consultationUncheckedUpdateInput = {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.email !== undefined ? { email: payload.email } : {}),
            ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
            ...(payload.courseId !== undefined ? { course_id: payload.courseId } : {}),
            ...(payload.message !== undefined ? { message: payload.message } : {}),
            ...(payload.status !== undefined ? { status: payload.status } : {}),
            ...(payload.targetScore !== undefined ? { target_score: payload.targetScore } : {}),
            updated_at: new Date(),
            updated_by: payload.updatedBy || "system",
            version: { increment: 1 },
        };

        return this.consultationDAO.update(id, data);
    }

    async deleteConsultation(id: number) {
        const existing = await this.consultationDAO.findById(id);
        if (!existing) throw new Error("CONSULTATION_NOT_FOUND");
        await this.consultationDAO.delete(id);
    }

    async deleteCourseByIds(ids: number[]) {
        await this.consultationDAO.deleteByIds(ids);
    }

    private async notifyAdmin(consultation: consultation) {
        const user = await this.userDAO.findById(1);
        if (!user?.email) {
            console.warn("ADMIN_EMAIL is not configured. Skip sending consultation notification.");
            return;
        }

        const createdAt =
            consultation.created_at instanceof Date
                ? consultation.created_at.toISOString()
                : consultation.created_at ?? "";

        const textBody = [
            "Thông tin đăng ký tư vấn mới:",
            `Họ tên: ${consultation.name}`,
            `Email: ${consultation.email}`,
            `Số điện thoại: ${consultation.phone ?? "-"}`,
            `Khóa học quan tâm (course_id): ${consultation.course_id ?? "-"}`,
            `Target score: ${consultation.target_score ?? "-"}`,
            `Message: ${consultation.message ?? "-"}`,
            `Status: ${consultation.status}`,
            `Created at: ${createdAt}`,
        ].join("\n");

        const htmlBody = `
            <h3>Thông tin đăng ký tư vấn mới</h3>
            <ul>
                <li><strong>Họ tên:</strong> ${consultation.name}</li>
                <li><strong>Email:</strong> ${consultation.email}</li>
                <li><strong>Số điện thoại:</strong> ${consultation.phone ?? "-"}</li>
                <li><strong>Khóa học (course_id):</strong> ${consultation.course_id ?? "-"}</li>
                <li><strong>Target score:</strong> ${consultation.target_score ?? "-"}</li>
                <li><strong>Message:</strong> ${consultation.message ?? "-"}</li>
                <li><strong>Status:</strong> ${consultation.status}</li>
                <li><strong>Created at:</strong> ${createdAt}</li>
            </ul>
        `;

        await sendMail({
            to: user.email,
            subject: `[PTE iPASS] New consultation request from ${consultation.name}`,
            text: textBody,
            html: htmlBody,
        });
    }
}

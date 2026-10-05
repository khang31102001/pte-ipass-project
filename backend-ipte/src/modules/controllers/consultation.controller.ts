import { Request, Response } from "express";
import { ConsultationService } from "@services/consultation.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { ConsultationDTO } from "@dto/ConsultationDTO";
import { verifyRecaptchaV3 } from "@utils/recaptcha";

const consultationService = new ConsultationService();

export class ConsultationController {
    async createConsultationRequest(req: Request, res: Response) {
        const THRESHOLD = 0.5;

        const ip =
            (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
            req.socket.remoteAddress ??
            undefined;

        const { success, actionOk, score } = await verifyRecaptchaV3({
            token: req.body.recaptchaToken,
            ip,
            expectedAction: "contact_form",
        });

        if (!success || !actionOk || score < THRESHOLD) {
            return res.status(403).json({ error: "recaptcha_failed", score });
        }

        let payload: Partial<ConsultationDTO>;
        try {
            payload = parseJsonField<Partial<ConsultationDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }

        if (!payload.name || !payload.email) {
            return res.status(400).json({ message: "Name and email are required." });
        }

        try {
            const created = await consultationService.createConsultationRequest(payload);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (e) {
            res.status(500).json({
                message: "Failed to create consultation request.",
            });
        }
    }

    async list(req: Request, res: Response) {
        try {
            const { search, status, courseId, page, pageSize } = req.query;
            const result = await consultationService.list({
                q: search as string | undefined,
                status: status as string | undefined,
                courseId: courseId ? Number(courseId) : undefined,
                page: page ? Number(page) : undefined,
                page_size: pageSize ? Number(pageSize) : undefined,
            });
            res.json(camelCaseKeysDeep(result));
        } catch {
            res.status(500).json({ message: "Failed to list consultations." });
        }
    }

    async getById(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid consultation_id." });
        try {
            const data = await consultationService.getById(id);
            res.json(camelCaseKeysDeep(data));
        } catch (e: any) {
            if (e?.message === "CONSULTATION_NOT_FOUND")
                return res.status(404).json({ message: "Consultation not found." });
            res.status(500).json({ message: "Failed to get consultation." });
        }
    }

    async updateConsultation(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid consultation_id." });

        let payload: Partial<ConsultationDTO>;
        try {
            payload = parseJsonField<Partial<ConsultationDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }

        try {
            const updated = await consultationService.updateConsultation(id, payload);
            res.json(camelCaseKeysDeep(updated));
        } catch (e: any) {
            if (e?.message === "CONSULTATION_NOT_FOUND")
                return res.status(404).json({ message: "Consultation not found." });
            res.status(500).json({ message: "Failed to update consultation." });
        }
    }

    async deleteConsultation(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid consultation_id." });
        try {
            await consultationService.deleteConsultation(id);
            res.status(204).end();
        } catch (e: any) {
            if (e?.message === "CONSULTATION_NOT_FOUND")
                return res.status(404).json({ message: "Consultation not found." });
            res.status(500).json({ message: "Failed to delete consultation." });
        }
    }

    async deleteCourseByIds(req: Request, res: Response) {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.some((id) => typeof id !== "number")) {
                return res.status(400).json({ message: "Invalid consultation ids." });
            }

            await consultationService.deleteCourseByIds(ids);
            res.status(204).end();
        } catch (e: any) {
            return res.status(500).json({ message: "Failed to delete consultations." });
        }
    }
}

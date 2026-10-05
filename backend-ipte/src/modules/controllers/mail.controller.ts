import { Request, Response } from "express";

import { MailService, SendEmailPayload } from "@services/mail.service";
import { parseJsonField } from "@utils/requestParser";

export class MailController {
    async sendEmail(req: Request, res: Response) {
        let payload: SendEmailPayload | undefined;
        try {
            payload = parseJsonField<SendEmailPayload>(req);
        } catch {
            res.status(400).json({ message: "Invalid request payload." });
            return;
        }

        const { to, subject, content } = payload || {};

        const hasRecipient =
            typeof to === "string"
                ? Boolean(to.trim())
                : Array.isArray(to) && to.some((item) => Boolean(item?.trim()));

        if (!hasRecipient || !subject?.trim() || !content?.trim()) {
            return res.status(400).json({ message: "Fields to, subject and content are required." });
        }

        const normalizedTo = Array.isArray(to)
            ? to.filter(Boolean).map((item) => item.trim())
            : to.trim();

        try {
            await MailService.sendEmail({
                to: normalizedTo,
                subject: subject.trim(),
                content: content.trim(),
            });
            res.json({ message: "Email sent successfully." });
        } catch (e: any) {
            if (e?.message === "MAILER_NOT_CONFIGURED") {
                return res.status(500).json({ message: "Email service is not configured." });
            }
            console.error("Failed to send email:", e);
            res.status(500).json({ message: "Failed to send email." });
        }
    }
}

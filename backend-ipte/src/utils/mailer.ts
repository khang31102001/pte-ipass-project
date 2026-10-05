import nodemailer from "nodemailer";

import { config } from "@config/index";

type SendMailInput = {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
    if (transporter) return transporter;

    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
        console.warn("SMTP configuration missing. Skipping email send.");
        return null;
    }

    transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
        },
    });

    return transporter;
}

export async function sendMail(options: SendMailInput): Promise<void> {
    const transporterInstance = getTransporter();
    if (!transporterInstance) {
        throw new Error("MAILER_NOT_CONFIGURED");
    }

    await transporterInstance.sendMail({
        from: config.SMTP_FROM,
        ...options,
    });
}

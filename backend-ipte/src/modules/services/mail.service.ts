import { sendMail } from "@utils/mailer";

export type SendEmailPayload = {
    to: string | string[];
    subject: string;
    content: string;
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderContent(content: string): string {
    const lines = content.trim().split(/\r?\n/);
    const blocks: string[] = [];
    let bullets: string[] = [];

    const flushBullets = () => {
        if (!bullets.length) return;
        const listItems = bullets
            .map((item) => `<li style="margin:4px 0; color:#0f172a;">${escapeHtml(item)}</li>`)
            .join("");
        blocks.push(
            `<ul style="margin:0 0 12px; padding-left:20px; color:#0f172a;">${listItems}</ul>`
        );
        bullets = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            flushBullets();
            continue;
        }

        if (/^-/.test(trimmed)) {
            bullets.push(trimmed.replace(/^-+\s*/, ""));
            continue;
        }

        flushBullets();
        blocks.push(`<p style="margin:0 0 12px; color:#0f172a;">${escapeHtml(trimmed)}</p>`);
    }

    flushBullets();

    if (!blocks.length) {
        return '<p style="margin:0; color:#0f172a;">(No content provided)</p>';
    }

    return blocks.join("");
}

function buildHtmlBody(subject: string, content: string): string {
    const safeSubject = escapeHtml(subject.trim());
    const formattedContent = renderContent(content);

    return `
        <div style="background:#f8fafc;padding:32px;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.08);overflow:hidden;">
                <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#475569;font-weight:700;">PTE iPASS</div>
                    <div style="font-size:20px;font-weight:700;margin-top:6px;">${safeSubject}</div>
                </div>
                <div style="padding:24px;line-height:1.7;">
                    ${formattedContent}
                </div>
                <div style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">
                    Email nay duoc gui tu he thong PTE iPASS.
                </div>
            </div>
        </div>
    `;
}

export class MailService {
    static async sendEmail(payload: SendEmailPayload) {
        const textBody = payload.content.trim();
        const htmlBody = buildHtmlBody(payload.subject, payload.content);

        await sendMail({
            to: payload.to,
            subject: payload.subject.trim(),
            text: textBody,
            html: htmlBody,
        });
    }
}

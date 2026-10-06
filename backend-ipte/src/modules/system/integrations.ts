import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../core/logger";
import { getIntegrationSecrets, getIntegrationSettings } from "./settings";

export interface Mail {
  to: string[];
  subject: string;
  text: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Gửi email qua SMTP cấu hình trong Cài đặt → Tích hợp (ưu tiên), hoặc biến môi trường SMTP_*.
 * Không ném lỗi ra ngoài: thất bại chỉ ghi log để không làm hỏng luồng nghiệp vụ (ví dụ lưu lead).
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (mail.to.length === 0) return false;
  try {
    const settings = await getIntegrationSettings();
    const secrets = await getIntegrationSecrets();
    const smtp = settings?.smtp;
    const cfg =
      smtp?.enabled && smtp.host
        ? { host: smtp.host, port: smtp.port ?? 587, secure: smtp.secure, user: smtp.username, pass: secrets.smtpPassword, from: smtp.fromEmail ? `"${smtp.fromName ?? "PTE iPASS"}" <${smtp.fromEmail}>` : undefined }
        : env.SMTP_HOST
          ? { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE === "true", user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.SMTP_FROM ?? env.SMTP_USER }
          : null;
    if (!cfg?.from) return false;

    const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, ...(cfg.user && cfg.pass ? { auth: { user: cfg.user, pass: cfg.pass } } : {}) });
    await transport.sendMail({ from: cfg.from, to: mail.to, subject: mail.subject, text: mail.text, html: `<pre style="font-family:inherit;white-space:pre-wrap">${esc(mail.text)}</pre>` });
    return true;
  } catch (error) {
    logger.error({ err: error }, "Gửi email thất bại");
    return false;
  }
}

export interface CaptchaResult {
  ok: boolean;
  reason?: string;
}

/**
 * Xác minh reCAPTCHA v3 khi được bật (Cài đặt → Tích hợp hoặc RECAPTCHA_SECRET).
 * Chưa bật ⇒ bỏ qua (ok). Bật mà thiếu/sai token hoặc điểm thấp ⇒ từ chối.
 */
export async function verifyCaptcha(token: string | undefined, ip: string | undefined): Promise<CaptchaResult> {
  const settings = await getIntegrationSettings();
  const secrets = await getIntegrationSecrets();
  const secret = secrets.recaptchaSecret ?? env.RECAPTCHA_SECRET;
  const enabled = settings?.recaptcha.enabled === true || Boolean(env.RECAPTCHA_SECRET);
  if (!enabled || !secret) return { ok: true };
  if (!token) return { ok: false, reason: "Thiếu mã xác minh reCAPTCHA" };

  try {
    const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const json = (await res.json()) as { success?: boolean; score?: number };
    if (!json.success) return { ok: false, reason: "Xác minh reCAPTCHA không thành công" };
    if (typeof json.score === "number" && json.score < env.RECAPTCHA_MIN_SCORE) return { ok: false, reason: "Yêu cầu bị nghi ngờ là tự động" };
    return { ok: true };
  } catch (error) {
    logger.warn({ err: error }, "reCAPTCHA không phản hồi");
    return { ok: false, reason: "Không xác minh được reCAPTCHA, vui lòng thử lại" };
  }
}

/** Báo website làm mới cache theo tag khi nội dung đổi (không chặn nếu website không phản hồi). */
export async function revalidateWebsite(tags: string[]): Promise<void> {
  if (!env.WEB_REVALIDATE_URL || !env.WEB_REVALIDATE_SECRET) return;
  try {
    await fetch(env.WEB_REVALIDATE_URL, { method: "POST", headers: { "content-type": "application/json", "x-revalidate-secret": env.WEB_REVALIDATE_SECRET }, body: JSON.stringify({ tags }), signal: AbortSignal.timeout(5000) });
  } catch (error) {
    logger.warn({ err: error }, "Không gọi được webhook revalidate website");
  }
}

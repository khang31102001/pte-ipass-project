import "dotenv/config";
import { z } from "zod";

/** Cấu hình môi trường tập trung; không dùng process.env rải rác. Thiếu/sai ⇒ dừng ngay khi khởi động. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  LEGACY_DATABASE_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET phải ≥ 32 ký tự"),
  JWT_ACCESS_EXPIRES: z.string().regex(/^\d+[smhd]$/, "Định dạng như 15m, 1h").default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).default(14),
  /** Khóa mã hóa bí mật cấu hình (SMTP, reCAPTCHA…), 32 byte dạng hex hoặc base64. */
  SECRETS_KEY: z.string().min(32, "SECRETS_KEY phải ≥ 32 ký tự"),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),

  /** Webhook làm mới cache website (Next) khi nội dung đổi. */
  WEB_REVALIDATE_URL: z.string().optional(),
  WEB_REVALIDATE_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  RECAPTCHA_SECRET: z.string().optional(),
  RECAPTCHA_MIN_SCORE: z.coerce.number().default(0.5),

  UPLOAD_DIR: z.string().default("storage"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:4000"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Cấu hình môi trường không hợp lệ → ${detail}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

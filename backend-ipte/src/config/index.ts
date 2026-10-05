import dotenv from "dotenv";
dotenv.config();

export const config = {
    port: process.env.PORT || 4000,
    env: process.env.NODE_ENV || "development",
    databaseUrl: process.env.DATABASE_URL || "",
    domain: process.env.DOMAIN || "http://localhost:4000",
    IMGBB_API_KEY: process.env.IMGBB_API_KEY || "",
    IMGBB_URL_UPLOAD: process.env.IMGBB_URL_UPLOAD || "",
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(",")
        : ["http://localhost:3000"],
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || "tranthanhhuy19032001.ltp@gmail.com",
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: Number(process.env.SMTP_PORT || 587),
    SMTP_SECURE: process.env.SMTP_SECURE === "true",
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@ipte.local",
};

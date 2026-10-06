import pino from "pino";
import { env, isProd } from "../config/env";

/** Log có cấu trúc; che các trường nhạy cảm để không lọt mật khẩu/token ra log. */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : isProd ? "info" : "debug",
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash", "*.refreshToken", "*.token"],
    censor: "[REDACTED]",
  },
  ...(isProd ? {} : { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }),
});

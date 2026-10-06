import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { resolve } from "node:path";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./core/http/error-handler";
import { logger } from "./core/logger";
import { apiRouter } from "./routes";

export function createApp(): Express {
  const app = express();
  if (env.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  // Tệp tải lên / ảnh đã tách khi migrate: chỉ phục vụ tệp tĩnh, không liệt kê thư mục, cho phép website khác origin hiển thị ảnh.
  app.use("/storage", (_req, res, next) => { res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); next(); }, express.static(resolve(env.UPLOAD_DIR), { index: false, dotfiles: "deny", maxAge: "7d" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

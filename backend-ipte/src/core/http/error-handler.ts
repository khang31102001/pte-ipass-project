import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../logger";
import { HttpError } from "./errors";

const body = (message: string, code: string, errors: unknown[] = []) => ({ success: false, data: null, message, errors, code });

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(body(`Không tìm thấy đường dẫn ${req.method} ${req.path}`, "NOT_FOUND"));
};

/** Mọi lỗi → envelope chuẩn. Lỗi lạ chỉ ghi log phía server, không lộ chi tiết ra client. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json(body(error.message, error.code, error.errors));
  }
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json(body("JSON không hợp lệ", "VALIDATION_ERROR"));
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return res.status(404).json(body("Không tìm thấy dữ liệu", "NOT_FOUND"));
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return res.status(422).json(body("Dữ liệu bị trùng", "VALIDATION_ERROR", [{ field: String(error.meta?.["target"] ?? ""), message: "Giá trị đã tồn tại" }]));
  }
  if (typeof (error as { status?: number }).status === "number" && (error as { status: number }).status < 500) {
    return res.status((error as { status: number }).status).json(body("Yêu cầu không hợp lệ", "VALIDATION_ERROR"));
  }
  logger.error({ err: error, path: req.path, method: req.method }, "Unhandled error");
  return res.status(500).json(body("Lỗi máy chủ, vui lòng thử lại sau", "SERVER_ERROR"));
};

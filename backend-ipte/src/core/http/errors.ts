export type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TOO_MANY_REQUESTS" | "SERVER_ERROR";

export interface FieldError {
  field: string;
  message: string;
}

/** Lỗi nghiệp vụ có mã HTTP + mã lỗi chuẩn của contract (docs/api-contract.md). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly errors: FieldError[] = [],
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, errors: FieldError[] = []) => new HttpError(422, "VALIDATION_ERROR", message, errors);
export const unauthorized = (message = "Chưa đăng nhập hoặc phiên đã hết hạn") => new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Bạn không có quyền thực hiện thao tác này") => new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Không tìm thấy dữ liệu") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (message: string, errors: FieldError[] = []) => new HttpError(409, "CONFLICT", message, errors);
export const tooMany = (message = "Quá nhiều yêu cầu, vui lòng thử lại sau") => new HttpError(429, "TOO_MANY_REQUESTS", message);

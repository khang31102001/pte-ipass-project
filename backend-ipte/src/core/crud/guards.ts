import type { AuthContext } from "../../auth/auth.types";
import type { Permission, Resource } from "../../contract/permissions";
import { forbidden } from "../http/errors";

/**
 * Quy tắc phê duyệt: chuyển sang trạng thái "published" cần quyền `<resource>.approve`.
 * Kiểm tra ở backend, độc lập với việc FE ẩn lựa chọn "Đã đăng".
 */
export function publishGuard<T extends { status: string }>(resource: Resource) {
  return ({ input, current, auth }: { input: { status?: string }; current?: T; auth: AuthContext | undefined }): void => {
    const becomingPublished = input.status === "published" && current?.status !== "published";
    if (becomingPublished && !auth?.permissions.has(`${resource}.approve` as Permission)) throw forbidden("Bạn cần quyền Duyệt để xuất bản nội dung này");
  };
}

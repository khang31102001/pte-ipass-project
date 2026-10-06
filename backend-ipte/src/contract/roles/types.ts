// GENERATED bởi scripts/sync-contract.mjs từ fe-pte-ipass — KHÔNG sửa tay. Sửa ở FE rồi chạy `npm run contract:sync`.
import type { BaseEntity, ListQuery } from "../api";

export interface Role extends BaseEntity {
  name: string;
  description?: string;
  /** Danh sách quyền "resource.action". */
  permissions: string[];
  /** Vai trò hệ thống: không được xóa. */
  isSystem: boolean;
  /** Số người dùng đang giữ vai trò (do API tính). */
  userCount: number;
}

export type RoleQuery = ListQuery;

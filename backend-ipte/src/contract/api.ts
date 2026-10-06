// GENERATED bởi scripts/sync-contract.mjs từ fe-pte-ipass — KHÔNG sửa tay. Sửa ở FE rồi chạy `npm run contract:sync`.
export interface BaseEntity { id: string; createdAt: string; updatedAt: string }
export type SortOrder = "asc" | "desc";
export interface ListQuery { page?: number; pageSize?: number; q?: string; sortBy?: string; sortOrder?: SortOrder }

// GENERATED bởi scripts/sync-contract.mjs từ fe-pte-ipass — KHÔNG sửa tay. Sửa ở FE rồi chạy `npm run contract:sync`.
import type { BaseEntity, ListQuery } from "../api";
import type { ContentStatus } from "../domain/content";

/** Câu chuyện thành công / cảm nhận học viên hiển thị trên website. */
export interface Testimonial extends BaseEntity {
  studentName: string;
  /** Ví dụ: "Du học Úc – từ PTE 36 lên 65". */
  headline: string;
  quote: string;
  avatarUrl?: string;
  scoreBefore?: number;
  scoreAfter: number;
  /** 1–5 */
  rating: number;
  courseId?: string;
  courseName?: string;
  videoUrl?: string;
  isFeatured: boolean;
  status: ContentStatus;
  sortOrder: number;
}

export interface TestimonialQuery extends ListQuery {
  status?: ContentStatus;
  courseId?: string;
  isFeatured?: "true" | "false";
}

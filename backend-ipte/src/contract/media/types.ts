// GENERATED bởi scripts/sync-contract.mjs từ fe-pte-ipass — KHÔNG sửa tay. Sửa ở FE rồi chạy `npm run contract:sync`.
import type { BaseEntity, ListQuery } from "../api";

export const MEDIA_KINDS = ["image", "video", "audio", "document"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: "Hình ảnh",
  video: "Video",
  audio: "Âm thanh",
  document: "Tài liệu",
};

/** Mục trong thư viện media: lưu metadata + URL (tệp thật được tải lên kho lưu trữ của backend). */
export interface MediaItem extends BaseEntity {
  name: string;
  kind: MediaKind;
  url: string;
  mimeType?: string;
  sizeKb?: number;
  width?: number;
  height?: number;
  altText?: string;
  folder: string;
  tags: string[];
}

export interface MediaQuery extends ListQuery {
  kind?: MediaKind;
  folder?: string;
}

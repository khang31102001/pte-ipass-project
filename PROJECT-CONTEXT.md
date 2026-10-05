# PTE iPASS — Context dự án (handoff cho giai đoạn build Backend + tích hợp)

> Cập nhật: 2026-10-05. Đọc file này trước khi bắt đầu build backend hoặc tích hợp auth.

## 1. Hiện trạng thư mục

| Thư mục | Vai trò | Trạng thái |
|---|---|---|
| `fe-pte-ipass/` | **Source FE chính, duy nhất** (Next 15, React 19, Tailwind 4, TS strict) | Hoàn thiện 10 phase, 97 test, build xanh. Chưa có commit git |
| `admin-dashboard-ipte/` | Admin cũ (React + Vite) | Chỉ tham khảo, không sửa. Sẽ bỏ |
| `frontend-ipte/` | Site user cũ (Next 14) | Chưa port. Sẽ port để dùng API công khai |
| (backend) | Chưa có | **Sẽ build sau**, theo contract bên dưới |

Backend cũ `https://backend-ipte.onrender.com/api` trả `{items,total,...}`, KHÔNG theo contract mới. Backend mới phải theo contract mới.

## 2. Mục tiêu & ràng buộc đã chốt

- Một app Next.js, kiến trúc theo feature, dễ mở rộng/xóa/thêm module, scale được.
- FE **không** phụ thuộc dữ liệu mock: `Page → Hook → Service → apiClient → REST`. Mock chạy như REST API thật tại `/api/*`.
- Chuyển sang backend thật chỉ đổi env (`NEXT_PUBLIC_API_BASE_URL`, `MOCK_API_ENABLED=false`, `NEXT_PUBLIC_DEV_TOOLS=false`), không sửa component/hook/service/type.
- **Identity / Authentication / Authorization / Permission do chủ dự án cung cấp, không build lại.** FE chỉ có `AuthAdapter` (cắm vào). Khi tích hợp, phải hỏi chủ dự án thông tin cụ thể.
- Website public: giới thiệu khóa học, thương hiệu, SEO, thu lead (tư vấn/học thử), tích hợp GA/GTM. **Không làm bài thi trực tiếp** trên site. Ngân hàng câu hỏi chỉ là quản trị nội dung phía admin.
- Chat/Zalo/Messenger: chỉ nhúng widget bên thứ ba, không tự xây chatbot.
- Ưu tiên của chủ dự án: chuẩn hóa source trước, nghiệp vụ nâng cao sau; hỏi ngược khi chưa rõ; báo cáo khi xong.

## 3. Nơi chứa tài liệu kỹ thuật (nguồn sự thật)

| File | Nội dung |
|---|---|
| `fe-pte-ipass/docs/api-contract.md` | Envelope, mã lỗi, phân trang/lọc/sắp xếp, CRUD, RBAC, lookup, API công khai, bí mật chỉ ghi |
| `fe-pte-ipass/docs/api-endpoints.md` | 160 endpoint + quyền yêu cầu (sinh từ Mock: `node scripts/generate-api-docs.mjs`) |
| `fe-pte-ipass/src/features/<module>/{types,schemas}.ts` | **DTO + validation (zod)** của từng module. Backend phải khớp |
| `fe-pte-ipass/src/core/rbac/permissions.ts` | Danh mục quyền `resource.action` (23 resource × view/create/edit/delete/approve/export) |
| `fe-pte-ipass/src/mock/modules/*.ts` | Hành vi nghiệp vụ mẫu mà backend cần hiện thực (xem mục 5) |
| `fe-pte-ipass/src/mock/engine/*.test.ts` | Test mô tả hành vi API mong đợi (chạy được: `npm test`) |
| `fe-pte-ipass/docs/ARCHITECTURE.md`, `docs/adr/` | Kiến trúc và quyết định (ADR-0001 một app Next; 0002 mock = REST thật; 0003 auth adapter) |
| `fe-pte-ipass/CLAUDE.md` | Luật làm việc trong repo FE |

## 4. Module & endpoint chính (tóm tắt)

students (+profile, journey/advance, journey/notes, export) · courses, course-categories, lessons · learning-paths (+generate), learning-materials · questions (+export) · teachers · pages · articles, article-categories, tags · forms, form-submissions (+export) · testimonials · site-config (singleton) · banners · media · branches, rooms · users (+export), roles, permissions · audit-logs (+export, chỉ đọc) · settings/global, settings/integration, notification-templates · dashboard/summary · reports/funnel (+export), lead-sources, enrollments · lookups/:name · auth/me · public/site-config, public/forms/:slug(+/submit).

## 5. Hành vi backend BẮT BUỘC (mock đã mô phỏng, test đã khóa)

1. **Envelope** `{success,data,message,meta?}` / lỗi `{success:false,data:null,message,errors[],code}`; luôn trả envelope (kể cả xóa). Validation: 422, `errors[].field` dạng `a.b.0.c`.
2. **Kiểm tra quyền độc lập tại mọi endpoint** (`resource.action`). FE ẩn nút không phải bảo mật. `GET /auth/me` trả `{user, role, permissions[]}`.
3. **`approve`**: chuyển sang `published` (course, page, article, testimonial) cần `<resource>.approve`; thiếu ⇒ 403.
4. **Audit log tự động** mọi create/update/delete/export: actor, role, action, resource, entityId, nhãn, `before`/`after`, IP, thời điểm.
5. **Ràng buộc nghiệp vụ**: trùng (email/code/slug) ⇒ 422 theo field; xóa bản ghi còn liên quan ⇒ 409 (danh mục còn khóa học, giáo viên đang phụ trách, cơ sở còn phòng, vai trò hệ thống/đang dùng, biểu mẫu đã có dữ liệu…); xóa học viên/khóa học cascade dữ liệu con; vai trò Admin không bị giảm quyền.
6. **Hành trình học viên**: chỉ chuyển tiếp (lùi ⇒ 409); `exam` cần ngày thi, `result` cần điểm; tạo học viên sinh mã `HV-xxxxx` + sự kiện đầu tiên; hồ sơ PTE trả `null` khi chưa có.
7. **Danh sách**: `q` tìm không phân biệt dấu tiếng Việt; filter phẳng; `sortBy` có allowlist; `pageSize` ≤ 200; `/export` trả toàn bộ theo filter, cần quyền `export`.
8. **Lộ trình gợi ý** (`POST /learning-paths/generate`): tham lam ít bước nhất, tuần tự, điều chỉnh theo giờ học/tuần, cảnh báo trễ hạn.
9. **Bí mật cấu hình** (SMTP password, reCAPTCHA secret) chỉ ghi; GET chỉ trả `hasPassword/hasSecret`. Không lộ `notifyEmails`, `updatedByName` ở API công khai.
10. **Lead công khai**: `POST /public/forms/:slug/submit` validate theo định nghĩa trường (required/email/phone/select/checkbox), lưu UTM/referrer, trạng thái `new`; nên có reCAPTCHA + rate limit ở backend thật.
11. **Dashboard/Report** tính từ dữ liệu thật (phễu = số học viên đã đi qua từng giai đoạn; KPI lead/ghi danh/đạt mục tiêu/điểm tăng).

## 6. Việc cần làm ở giai đoạn Backend & tích hợp

### Build backend
- [ ] Chọn stack; dựng schema DB cho các entity ở mục 4 (đối chiếu `features/*/types.ts`).
- [ ] Hiện thực envelope/lỗi/phân trang chung (middleware) trước, rồi từng module theo `api-endpoints.md`.
- [ ] RBAC: lưu role/permission theo danh mục `permissions.ts`; kiểm tra ở middleware từng route.
- [ ] Audit log tự động; seed role Admin/Sales/Academic/Teacher/Marketing/Finance (xem `mock/modules/iam.ts`).
- [ ] CORS cho origin FE nếu khác domain; cookie phiên httpOnly nếu dùng cookie.
- [ ] Đối chiếu bằng test: chạy lại bộ test hành vi (`mock/engine/*.test.ts`) làm checklist, hoặc viết contract test chạy vào backend thật.

### Tích hợp FE ↔ BE
1. Đặt env: `NEXT_PUBLIC_API_BASE_URL=<url backend>`, `MOCK_API_ENABLED=false`, `NEXT_PUBLIC_DEV_TOOLS=false`.
2. **Hỏi chủ dự án** cách xác thực (JWT/cookie/OIDC…), endpoint đăng nhập/làm mới/đăng xuất, định dạng quyền.
3. Viết `AuthAdapter` thật (mẫu: `src/core/auth/dev-adapter.ts`), thay `createDevAuthAdapter` tại `src/app/(admin)/admin/providers.tsx`; thêm `middleware.ts` chặn `/admin`; token đưa sang cookie httpOnly (không dùng localStorage).
4. Chạy `npm run typecheck && npm run lint && npm test && npm run build`, rồi duyệt tay từng màn hình với dữ liệu thật; sửa lệch contract ở `types/schemas` (một chỗ, FE + test cùng cập nhật).
5. Site public đã nằm trong app mới và gọi `/public/*`: backend hiện thực đủ các endpoint ở `docs/public-site.md` (chỉ trả nội dung đã xuất bản). Đặt `NEXT_PUBLIC_APP_BASE_URL`, `REVALIDATE_SECRET`; cấu hình webhook gọi `POST /api/revalidate` khi nội dung đổi.

## 7. Việc còn tồn

- Site public đã port (xem `fe-pte-ipass/docs/public-site.md`); còn: middleware auth; rich-text editor (textarea hiện tại); upload file thật cho media; dark mode toggle.
- **Rotate key TinyMCE** (đã lộ trong repo admin cũ); `.env` các repo cũ đang bị commit.
- `npm audit`: postcss trong Next 15 (cần Next 16 để dứt điểm; rủi ro build-time).
- Dùng `npm` (chưa có pnpm). Git `fe-pte-ipass` chưa có commit, chủ dự án chưa yêu cầu.
- Dữ liệu mock nằm trong bộ nhớ; `POST /api/__mock/reset` đặt lại.

## 8. Lệnh hay dùng (trong `fe-pte-ipass/`)

```bash
npm run dev            # http://localhost:3000/admin  (⚗ góc dưới phải: đổi vai trò, giả lập chậm/lỗi/rỗng)
npm run typecheck && npm run lint && npm test && npm run build
node scripts/new-feature.mjs <ten> --noun "…" --title "…"   # sinh module mới
node scripts/generate-api-docs.mjs                          # cập nhật docs/api-endpoints.md
```

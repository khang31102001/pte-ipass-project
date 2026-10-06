
Bạn là  **Senior Full-stack Architect + Backend Engineer + Database Migration Engineer** , chịu trách nhiệm review và hoàn thiện hệ thống hiện tại theo hướng production-ready.

## 1. MỤC TIÊU

Quét toàn bộ source hiện tại, đặc biệt là Backend và Frontend, để:

* Hiểu kiến trúc hệ thống hiện tại.
* Mapping đầy đủ các module từ  **FE → API → Backend → Database** .
* Hoàn thiện các module còn thiếu.
* Kết nối FE với API thật.
* Chuẩn hóa Backend/API.
* Chuẩn hóa Database Schema.
* Migration dữ liệu từ database cũ sang schema mới.
* Backup database trước khi thực hiện bất kỳ migration nào.
* Test toàn bộ module end-to-end.
* Fix bug phát hiện trong quá trình triển khai.
* Cuối cùng cung cấp báo cáo tổng hợp.

Thực hiện theo flow bắt buộc:

**GATHERING → ANALYSIS → DEVELOPMENT → FE → BE → DB → BACKUP → MIGRATION → TESTING → BUG FIXING → FINAL REPORT**

---

# PHASE 1 — GATHERING

Trước khi code, hãy scan toàn bộ source.

Đọc và phân tích:

### Frontend

* Pages / Routes
* Layout
* Components
* Features
* Hooks
* Services
* API Client
* Types / Interfaces
* Forms
* Tables
* Navigation
* Permissions
* Mock API / Mock JSON hiện tại

### Backend

* Routes
* Controllers
* Services
* Repositories
* DTO
* Validation
* Middleware
* Authentication
* Authorization / RBAC
* Database Models
* ORM
* Migrations
* Seeds
* Environment configuration

### Database

Phân tích:

* Tables
* Columns
* PK
* FK
* Indexes
* Constraints
* Relationships
* Existing data
* Legacy tables
* Duplicate data
* Null/inconsistent data
* Các bảng hiện tại đang phục vụ module nào.

Database hiện tại phải được lấy từ biến môi trường:

`<span>DATABASE_URL</span>`

Không hard-code credential vào source code.

Không ghi password/database credential vào:

* source
* migration file
* console log
* report
* Git commit

---

# PHASE 2 — ANALYSIS

Sau khi gathering, tạo mapping:

`<span>Frontend Screen</span>`
→ `<span>Frontend Feature</span>`
→ `<span>Service</span>`
→ `<span>API Endpoint</span>`
→ `<span>Backend Controller</span>`
→ `<span>Backend Service</span>`
→ `<span>Repository</span>`
→ `<span>Database Table</span>`

Ví dụ:

`<span>Students Page</span>`
→ `<span>Student Feature</span>`
→ `<span>studentService</span>`
→ `<span>GET /api/students</span>`
→ `<span>StudentController</span>`
→ `<span>StudentService</span>`
→ `<span>StudentRepository</span>`
→ `<span>students</span>`

Lập matrix cho toàn bộ module:

1. Students
2. Student Profile
3. Student Journey
4. Course Catalog
5. Course Categories
6. Teachers
7. Learning Paths
8. Learning Materials
9. Lessons
10. Question Bank
11. Pages
12. Blog / Articles
13. Categories / Tags
14. Forms
15. Testimonials / Success Stories
16. Branches
17. Users & Roles
18. Permissions
19. Audit Logs
20. Settings
21. Dashboard & Reports
22. Chat / Zalo / Messenger Integration
23. Site Configuration

Với từng module xác định trạng thái:

* FE đã có / chưa có
* API đã có / chưa có
* Backend đã có / chưa có
* Database đã có / chưa có
* API đang dùng Mock hay Real API
* CRUD nào đã có
* CRUD nào còn thiếu
* Relationship nào còn thiếu
* Permission nào cần áp dụng
* Migration nào cần thực hiện

---

# PHASE 3 — DEVELOPMENT PLAN

Trước khi sửa code, lập kế hoạch implementation.

Không code ngẫu nhiên từng màn hình.

Thứ tự ưu tiên:

### Layer 1 — Database

Schema + relationship + constraints.

### Layer 2 — Backend

Repository → Service → Controller → API.

### Layer 3 — Frontend

Service → Hooks → Feature → UI.

Flow chuẩn:

`<span>FE</span>`
→ `<span>API Client</span>`
→ `<span>REST API</span>`
→ `<span>Controller</span>`
→ `<span>Service</span>`
→ `<span>Repository</span>`
→ `<span>PostgreSQL</span>`

Không cho FE truy cập trực tiếp Database.

Không cho Component gọi trực tiếp database/mock JSON.

---

# PHASE 4 — DATABASE BACKUP

ĐÂY LÀ BƯỚC BẮT BUỘC TRƯỚC MIGRATION.

Trước khi thay đổi database:

1. Kiểm tra kết nối database.
2. Kiểm tra dung lượng và schema.
3. Tạo backup đầy đủ database hiện tại.
4. Backup phải có timestamp.

Ví dụ:

`<span>backup_ipte_YYYYMMDD_HHmmss.dump</span>`

Ưu tiên PostgreSQL custom format:

`<span>pg_dump -Fc</span>`

Backup phải bao gồm:

* Schema
* Data
* Constraints
* Sequence
* Index
* Relationships

Sau backup:

* Verify backup tồn tại.
* Kiểm tra file size.
* Kiểm tra backup có thể đọc được bằng `<span>pg_restore --list</span>`.

Nếu backup thất bại:

**DỪNG MIGRATION.**

Không được tiếp tục thay đổi database.

---

# PHASE 5 — DATABASE SCHEMA

Dựa trên module và dữ liệu hiện tại, thiết kế schema mới.

Nguyên tắc:

* Không duplicate table.
* Không duplicate business entity.
* PK/FK rõ ràng.
* Index cho các trường search/filter thường xuyên.
* Unique constraint khi cần.
* created_at / updated_at.
* Soft delete nếu nghiệp vụ cần.
* Audit fields nếu phù hợp.

Relationship phải được xác định rõ.

Ví dụ:

Student
→ StudentProfile
→ StudentJourney
→ Enrollment
→ LearningPath

Course
→ CourseCategory
→ Lesson
→ Material
→ QuestionBank

Teacher
→ Course
→ Class / Assignment

User
→ Role
→ Permission

Không tạo table chỉ vì UI đang có một section.

Schema phải dựa trên  **business entity và relationship thực tế** .

---

# PHASE 6 — DATA MIGRATION

Migration phải bảo toàn dữ liệu cũ.

Không được:

* Drop dữ liệu ngay lập tức.
* Xóa table legacy trước khi verify migration.
* Ghi đè dữ liệu mà chưa mapping.

Thực hiện theo flow:

`<span>OLD DATA</span>`
→ `<span>Extract</span>`
→ `<span>Transform</span>`
→ `<span>Validate</span>`
→ `<span>Load</span>`
→ `<span>Verify</span>`

Trước migration phải lập:

## Migration Mapping

Ví dụ:

`<span>old_students</span>`
→ `<span>students</span>`

`<span>old_student_target</span>`
→ `<span>student_profiles.target_score</span>`

`<span>old_course</span>`
→ `<span>courses</span>`

Mapping phải chỉ rõ:

* Source Table
* Source Column
* Target Table
* Target Column
* Transformation Rule
* Default Value
* Nullable
* Conflict handling

---

# PHASE 7 — MIGRATION VALIDATION

Sau mỗi migration phải kiểm tra:

### Record Count

`<span>OLD count</span>`
vs
`<span>NEW count</span>`

### Relationship

Kiểm tra:

* orphan FK
* missing reference
* duplicate record

### Business Data

Kiểm tra:

* Student
* Course
* Teacher
* Enrollment
* Learning Path
* Content
* User
* Permission

Không coi migration thành công chỉ vì SQL chạy không lỗi.

Phải đảm bảo dữ liệu nghiệp vụ đúng.

---

# PHASE 8 — BACKEND DEVELOPMENT

Hoàn thiện API thật cho toàn bộ module.

Mỗi module cần xem xét:

* GET List
* GET Detail
* POST
* PUT/PATCH
* DELETE
* Search
* Filter
* Sort
* Pagination

API Response phải thống nhất.

Success:

```
{
  "success": true,
  "data": {},
  "message": "Success",
  "meta": {}
}
```

Error:

```
{
  "success": false,
  "data": null,
  "message": "Error message",
  "errors": []
}
```

Backend phải thực hiện:

* Validation
* Authentication
* Authorization
* Error handling
* Transaction khi cần
* Logging phù hợp
* Không expose sensitive data.

---

# PHASE 9 — FRONTEND INTEGRATION

Scan lại FE hiện tại.

Thay các Mock API bằng API thật theo architecture:

`<span>Component</span>`
→ `<span>Hook</span>`
→ `<span>Service</span>`
→ `<span>API Client</span>`
→ `<span>Backend API</span>`

Không gọi fetch/axios rải rác trong Component.

API Base URL phải dùng ENV:

`<span>NEXT_PUBLIC_API_BASE_URL</span>`

Mục tiêu:

Không thay đổi business logic của Component khi thay API endpoint.

---

# PHASE 10 — RBAC

Mapping:

`<span>User</span>`
→ `<span>Role</span>`
→ `<span>Permission</span>`
→ `<span>Resource + Action</span>`

Ví dụ:

* student.view
* student.create
* student.edit
* student.delete
* student.export

Frontend Permission Guard chỉ kiểm soát UX.

Backend vẫn bắt buộc kiểm tra permission.

Không được coi việc ẩn button trên FE là security.

---

# PHASE 11 — TESTING ALL MODULES

Sau khi hoàn thành development + migration, test toàn bộ hệ thống.

Test tối thiểu:

### Authentication

* Login
* Logout
* Invalid credentials
* Session/token

### Authorization

* Role
* Permission
* Unauthorized access

### CRUD

* Create
* Read
* Update
* Delete

### List

* Pagination
* Search
* Filter
* Sort

### UI

* Loading
* Empty State
* Error State
* Success State

### Integration

Test flow thật:

`<span>FE</span>`
→ `<span>API</span>`
→ `<span>Backend</span>`
→ `<span>Database</span>`

Không chỉ test API độc lập.

---

# PHASE 12 — MODULE TEST MATRIX

Mỗi module phải có trạng thái:

| Module | FE | API | BE | DB | Migration | CRUD | Permission | E2E | Status |
| ------ | -- | --- | -- | -- | --------- | ---- | ---------- | --- | ------ |

Status:

* PASS
* FAIL
* PARTIAL
* NOT IMPLEMENTED

Không được báo DONE nếu module vẫn còn PARTIAL.

---

# PHASE 13 — BUG FIXING

Nếu phát hiện bug trong quá trình test:

1. Xác định root cause.
2. Fix.
3. Regression test.
4. Test lại flow liên quan.
5. Ghi nhận vào final report.

Không chỉ workaround ở UI nếu bug thực tế nằm ở BE/DB.

---

# PHASE 14 — SAFETY

Các thao tác nguy hiểm như:

* DROP TABLE
* DROP COLUMN
* TRUNCATE
* mass DELETE
* destructive migration

chỉ được thực hiện khi:

1. Backup đã thành công.
2. Đã xác định rõ migration mapping.
3. Có rollback strategy.
4. Dữ liệu mới đã được verify.

Ưu tiên:

`<span>Create → Migrate → Verify → Switch → Cleanup</span>`

thay vì:

`<span>Drop → Recreate</span>`

---

# PHASE 15 — FINAL REPORT

Sau khi hoàn thành, báo cáo theo format:

## 1. Architecture

Kiến trúc trước và sau.

## 2. Modules

Module nào:

* Completed
* Partial
* Not implemented

## 3. Frontend

* Component đã sửa
* API integration
* Mock đã loại bỏ

## 4. Backend

* API mới
* Service mới
* Validation
* Permission

## 5. Database

* Table mới
* Table thay đổi
* Relationship
* Index
* Constraint

## 6. Migration

* Dữ liệu đã migrate
* Record count trước/sau
* Mapping
* Issue gặp phải

## 7. Backup

* Backup filename
* Backup status
* Verification status

KHÔNG đưa credential/password vào report.

## 8. Testing

Liệt kê:

* PASS
* FAIL
* Issue còn lại

## 9. Bugs Fixed

* Bug
* Root Cause
* Solution

## 10. Remaining Issues

Các vấn đề chưa giải quyết.

## 11. Final Status

Chỉ được kết luận:

`<span>SYSTEM READY</span>`

khi:

* Migration hoàn tất.
* FE → API → BE → DB hoạt động.
* Không còn critical bug.
* Các module chính E2E PASS.

Nếu chưa đạt, phải ghi:

`<span>SYSTEM NOT READY</span>`

và liệt kê nguyên nhân cụ thể.

---

# QUY TẮC THỰC THI

* Đọc source trước khi sửa.
* Tái sử dụng code hiện tại nếu hợp lý.
* Không duplicate architecture.
* Không over-engineering.
* Không phá UI hiện tại nếu không cần.
* Không fake kết quả test.
* Không báo DONE khi chưa test.
* Không xóa legacy data trước khi verify migration.
* Backup bắt buộc trước migration.
* Mọi thay đổi DB phải có migration.
* Migration phải có khả năng rollback.
* Fix bug trong phạm vi triển khai nếu phát hiện.
* Sau mỗi phase quan trọng phải kiểm tra hệ thống trước khi chuyển phase tiếp theo.

Quan trọng nhất:

**Không chỉ tạo code hoặc schema mới. Hãy hoàn thiện toàn bộ flow thực tế:**

`<span>UI → FE Logic → API → Backend → Database → Migrated Data → Testing</span>`

cho đến khi các module hoạt động end-to-end.

-- ==========================================
-- 5. Insert dữ liệu mẫu
-- ==========================================
INSERT INTO role (role_name, role_description, created_by)
VALUES ('ADMIN', 'Quản trị hệ thống', 'system'),
       ('USER', 'Người dùng thông thường', 'system');

INSERT INTO permission (permission_name, permission_description, created_by)
VALUES ('CREATE_POST', 'Tạo bài viết', 'system'),
       ('EDIT_POST', 'Chỉnh sửa bài viết', 'system'),
       ('DELETE_POST', 'Xóa bài viết', 'system'),
       ('VIEW_POST', 'Xem bài viết', 'system');

-- Mật khẩu mặc định là admin123 (đã mã hóa bcrypt cost=10)
INSERT INTO "user" (username, password, email, full_name, created_by)
VALUES ('admin', '$2b$10$QvqOokoSoj2YD/LiK76ICOxaFEpbAKy.Dr3ezc2pp6y0hUuYnfo8e', 'admin@ipte.edu.vn', 'Administrator', 'system');

INSERT INTO user_role (user_id, role_id, created_by)
SELECT u.user_id, r.role_id, 'system'
FROM "user" u, role r
WHERE u.username = 'admin' AND r.role_name = 'ADMIN';

INSERT INTO role_permission (role_id, permission_id, created_by)
SELECT r.role_id, p.permission_id, 'system'
FROM role r, permission p
WHERE r.role_name = 'ADMIN' AND p.permission_name IN ('CREATE_POST', 'EDIT_POST', 'DELETE_POST', 'VIEW_POST');

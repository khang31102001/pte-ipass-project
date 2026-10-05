# 📘 Backend IPTE

Backend cho website [https://ipte.edu.vn](https://ipte.edu.vn)  
Sử dụng **Node.js (Express + TypeScript)**, **PostgreSQL**, **Prisma ORM**.

---

## 🚀 Cấu trúc dự án

backend-ipte/
│── src/
│ ├── app.ts # Khởi tạo Express app
│ ├── server.ts # Entry point
│ ├── config/ # Cấu hình (DB, env, JWT)
│ ├── middlewares/ # Middleware
│ ├── modules/ # Controller / Service / DAO
│ ├── models/ # Entity (Prisma schema sinh ra)
│ ├── routes/ # Routes (admin/public)
│ └── utils/ # Helper (jwt, logger, etc.)
│
├── prisma/ # Prisma schema + migration
│ └── schema.prisma
│
├── .env # Config ENV
├── tsconfig.json
├── package.json
└── README.md

---

## ⚙️ Yêu cầu hệ thống

-   Node.js >= 18
-   PostgreSQL >= 14
-   Prisma >= 5

---

## 📦 Cài đặt

```bash
# Cài dependencies
npm install

# Generate Prisma client
npx prisma generate

```

# Tạo migration từ schema.prisma

npx prisma db pull # kéo schema từ DB
npx prisma generate # cập nhật Prisma Client

# Hoặc apply migration trên môi trường production

npx prisma migrate deploy

# chạy app

npm run dev

👉 App chạy ở: http://localhost:4000

# Production

npm run build
npm start

API Structure

Public API (không cần auth)

GET /api/posts → lấy danh sách bài viết

Admin API (cần JWT + role ADMIN)

POST /api/admin/users → tạo user

GET /api/admin/roles → danh sách roles

🛠️ Tools

Express: Web framework

Prisma ORM: Làm việc với PostgreSQL

JWT + bcrypt: Auth

ts-node-dev: Hot reload trong dev mode

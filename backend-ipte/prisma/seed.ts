/**
 * Seed nền tảng (idempotent): danh mục quyền, vai trò hệ thống, tài khoản Admin đầu tiên.
 * Mật khẩu Admin lấy từ SEED_ADMIN_PASSWORD (không bao giờ in ra log). Chạy lại an toàn: không ghi đè dữ liệu đã có.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordIssues } from "../src/auth/password";
import { ALL_PERMISSIONS } from "../src/contract/permissions";
import { ROLE_PRESETS } from "../src/modules/iam/role-presets";
import { seedWebsiteContent } from "./seed-content";

const prisma = new PrismaClient();

async function main() {
  for (const code of ALL_PERMISSIONS) {
    const [resource, action] = code.split(".") as [string, string];
    await prisma.permission.upsert({ where: { code }, create: { code, resource, action }, update: {} });
  }

  const permissions = await prisma.permission.findMany();
  const idOf = new Map(permissions.map((p) => [p.code, p.id]));

  for (const preset of ROLE_PRESETS) {
    const role = await prisma.role.upsert({
      where: { name: preset.name },
      create: { name: preset.name, description: preset.description, isSystem: true },
      update: { isSystem: true },
    });
    // Chỉ gán quyền mặc định cho vai trò MỚI hoặc Admin (Admin luôn đủ quyền); vai trò đã tùy chỉnh được giữ nguyên.
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0 || preset.name === "Admin") {
      await prisma.rolePermission.createMany({
        data: preset.permissions.map((c) => ({ roleId: role.id, permissionId: idOf.get(c) as string })),
        skipDuplicates: true,
      });
    }
  }

  const email = process.env["SEED_ADMIN_EMAIL"]?.trim().toLowerCase();
  const password = process.env["SEED_ADMIN_PASSWORD"];
  if (email && password) {
    const issue = passwordIssues(password);
    if (issue) throw new Error(`SEED_ADMIN_PASSWORD không đạt chính sách: ${issue}`);
    const admin = await prisma.role.findUniqueOrThrow({ where: { name: "Admin" } });
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      await prisma.user.create({ data: { email, fullName: "Quản trị hệ thống", roleId: admin.id, passwordHash: await hashPassword(password), status: "active" } });
      console.warn(`Đã tạo tài khoản Admin: ${email}`);
    }
  } else {
    console.warn("Bỏ qua tạo Admin: thiếu SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD");
  }

  await seedWebsiteContent(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

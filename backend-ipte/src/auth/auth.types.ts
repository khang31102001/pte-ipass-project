export interface AuthContext {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  branchId: string | null;
  /** Đang dùng mật khẩu tạm: chỉ được gọi /auth/me và /auth/change-password cho tới khi đổi. */
  mustChangePassword: boolean;
  permissions: ReadonlySet<string>;
  ip?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

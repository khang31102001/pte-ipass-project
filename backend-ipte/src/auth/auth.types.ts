export interface AuthContext {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  branchId: string | null;
  permissions: ReadonlySet<string>;
  ip?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

// GENERATED bởi scripts/sync-contract.mjs từ fe-pte-ipass — KHÔNG sửa tay. Sửa ở FE rồi chạy `npm run contract:sync`.
import { isPermission } from "../permissions";
import { requiredString, z } from "../validation";

export const roleSchema = z.object({
  name: requiredString("Vui lòng nhập tên vai trò").pipe(z.string().max(60, "Tối đa 60 ký tự")),
  description: z.string().trim().max(300, "Tối đa 300 ký tự").optional(),
  permissions: z.array(z.string().refine(isPermission, "Quyền không hợp lệ")),
});

export type RoleInput = z.infer<typeof roleSchema>;
export type RoleFormValues = z.input<typeof roleSchema>;

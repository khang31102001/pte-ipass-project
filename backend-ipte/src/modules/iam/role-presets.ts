import { ALL_PERMISSIONS, RESOURCE_ACTIONS, type Action, type Resource } from "../../contract/permissions";

const full = (...resources: Resource[]): string[] => resources.flatMap((r) => (RESOURCE_ACTIONS[r] as readonly Action[]).map((a) => `${r}.${a}`));
const only = (resource: Resource, ...actions: Action[]): string[] => actions.map((a) => `${resource}.${a}`);

export interface RolePreset {
  name: string;
  description: string;
  permissions: string[];
}

/** Vai trò hệ thống mặc định (không thể xóa). Quyền chi tiết chỉnh được ở màn hình Vai trò & quyền. */
export const ROLE_PRESETS: RolePreset[] = [
  { name: "Admin", description: "Toàn quyền hệ thống", permissions: [...ALL_PERMISSIONS] },
  {
    name: "Sales",
    description: "Tư vấn & chăm sóc học viên, xử lý lead",
    permissions: [
      ...only("student", "view", "create", "edit", "export"),
      ...only("course", "view"),
      ...only("learning_path", "view"),
      ...only("teacher", "view"),
      ...only("form", "view"),
      ...only("form_submission", "view", "edit", "export"),
      ...only("testimonial", "view"),
      ...only("branch", "view"),
      ...only("dashboard", "view"),
      ...only("report", "view"),
    ],
  },
  {
    name: "Academic",
    description: "Quản lý chương trình học, giáo viên, ngân hàng câu hỏi",
    permissions: [
      ...only("student", "view", "edit"),
      ...full("course", "lesson", "learning_path", "learning_material", "question", "teacher"),
      ...only("branch", "view"),
      ...only("dashboard", "view"),
    ],
  },
  {
    name: "Teacher",
    description: "Giáo viên: xem học viên, soạn học liệu và câu hỏi",
    permissions: [
      ...only("student", "view"),
      ...only("course", "view"),
      ...only("lesson", "view", "edit"),
      ...only("learning_material", "view", "create", "edit"),
      ...only("question", "view", "create", "edit"),
      ...only("teacher", "view"),
      ...only("dashboard", "view"),
    ],
  },
  {
    name: "Marketing",
    description: "Nội dung website, banner, biểu mẫu, cảm nhận học viên",
    permissions: [
      ...full("page", "article", "taxonomy", "form", "testimonial", "banner", "media"),
      ...only("form_submission", "view", "export"),
      ...only("site_config", "view", "edit"),
      ...only("course", "view"),
      ...only("dashboard", "view"),
      ...only("report", "view"),
    ],
  },
  {
    name: "Finance",
    description: "Báo cáo, đối soát, nhật ký hoạt động",
    permissions: [
      ...only("student", "view", "export"),
      ...only("report", "view", "export"),
      ...only("audit_log", "view", "export"),
      ...only("dashboard", "view"),
    ],
  },
];

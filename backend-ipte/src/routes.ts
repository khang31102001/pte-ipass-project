import { Router } from "express";
import { authenticate, requirePermission } from "./auth/middleware";
import { ALL_PERMISSIONS } from "./contract/permissions";
import { handler } from "./core/http/async";
import { ok } from "./core/http/response";
import { authRouter } from "./modules/auth/auth.routes";
import { articleCategoriesRouter, articlesRouter, pagesRouter, tagsRouter } from "./modules/cms/content";
import { bannersRouter, mediaRouter, testimonialsRouter } from "./modules/cms/engagement";
import { formsRouter, submissionsRouter } from "./modules/cms/forms";
import { auditLogsRouter } from "./modules/iam/audit-logs";
import { rolesRouter } from "./modules/iam/roles";
import { usersRouter } from "./modules/iam/users";
import { courseCategoriesRouter, coursesRouter, lessonsRouter } from "./modules/learning/courses";
import { learningPathsRouter } from "./modules/learning/learning-paths";
import { materialsRouter } from "./modules/learning/materials";
import { questionsRouter } from "./modules/learning/questions";
import { branchesRouter, roomsRouter } from "./modules/org/branches";
import { teachersRouter } from "./modules/org/teachers";
import { publicRouter } from "./modules/public/public.routes";
import { studentsRouter } from "./modules/students/students";
import { lookupsRouter } from "./modules/system/lookups";
import { dashboardRouter, reportsRouter } from "./modules/system/reports";
import { settingsRouter, templatesRouter } from "./modules/system/settings";
import { siteConfigRouter } from "./modules/system/site-config";

/**
 * Điểm gắn toàn bộ module vào /api. Thêm module = tạo `modules/<ten>/` rồi thêm một dòng `router.use` ở đây.
 * Mọi router (trừ /auth và /public) bắt buộc đăng nhập + kiểm tra quyền resource.action tại từng route.
 */
export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/public", publicRouter);

// Danh mục quyền (chỉ đọc) cho ma trận phân quyền.
apiRouter.get(
  "/permissions",
  authenticate,
  requirePermission("role.view"),
  handler(async (_req, res) => ok(res, ALL_PERMISSIONS.map((key) => ({ key, resource: key.split(".")[0], action: key.split(".")[1] })))),
);

apiRouter.use("/lookups", lookupsRouter);

// IAM
apiRouter.use("/roles", rolesRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/audit-logs", auditLogsRouter);

// Tổ chức
apiRouter.use("/branches", branchesRouter);
apiRouter.use("/rooms", roomsRouter);
apiRouter.use("/teachers", teachersRouter);

// Học thuật
apiRouter.use("/course-categories", courseCategoriesRouter);
apiRouter.use("/courses", coursesRouter);
apiRouter.use("/lessons", lessonsRouter);
apiRouter.use("/learning-materials", materialsRouter);
apiRouter.use("/learning-paths", learningPathsRouter);
apiRouter.use("/questions", questionsRouter);
apiRouter.use("/students", studentsRouter);

// CMS & website
apiRouter.use("/pages", pagesRouter);
apiRouter.use("/article-categories", articleCategoriesRouter);
apiRouter.use("/tags", tagsRouter);
apiRouter.use("/articles", articlesRouter);
apiRouter.use("/forms", formsRouter);
apiRouter.use("/form-submissions", submissionsRouter);
apiRouter.use("/testimonials", testimonialsRouter);
apiRouter.use("/banners", bannersRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/site-config", siteConfigRouter);

// Hệ thống
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/notification-templates", templatesRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/reports", reportsRouter);

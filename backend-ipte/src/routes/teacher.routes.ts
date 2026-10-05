import { Router } from "express";
import { TeacherController } from "@controllers/teacher.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";
import { upload } from "@middlewares/upload";

const router = Router();
const teacherController = new TeacherController();

router.get("/detail", teacherController.getTeacherDetail.bind(teacherController));
router.post(
    "/",
    authRole([Role.ADMIN]),
    upload.single("file"),
    teacherController.createTeacher.bind(teacherController)
);
router.get("/", teacherController.getTeachers.bind(teacherController));
router.get("/:id", teacherController.getTeacherById.bind(teacherController));
router.put(
    "/:id",
    authRole([Role.ADMIN]),
    upload.single("file"),
    teacherController.updateTeacher.bind(teacherController)
);
router.delete(
    "/:id",
    authRole([Role.ADMIN]),
    teacherController.deleteTeacher.bind(teacherController)
);
router.delete(
    "/",
    authRole([Role.ADMIN]),
    teacherController.deleteTeachersByIds.bind(teacherController)
);

export default router;

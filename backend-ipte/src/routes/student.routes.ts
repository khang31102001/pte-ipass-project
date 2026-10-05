import { Router } from "express";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";

import { StudentController } from "@controllers/student.controller";

const router = Router();
const studentController = new StudentController();

router.post("/", authRole([Role.ADMIN]), studentController.createStudent.bind(studentController));
router.get("/", studentController.getStudents.bind(studentController));
router.get("/detail", studentController.getStudentDetail.bind(studentController));
router.put("/:id", authRole([Role.ADMIN]), studentController.updateStudent.bind(studentController));

export default router;

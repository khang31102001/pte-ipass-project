import { Router } from "express";
import { ConsultationController } from "@controllers/consultation.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";

const router = Router();
const consultationController = new ConsultationController();

router.post("/", consultationController.createConsultationRequest.bind(consultationController));
router.get("/", authRole([Role.ADMIN]), consultationController.list.bind(consultationController));
router.get("/:id", authRole([Role.ADMIN]), consultationController.getById.bind(consultationController));
router.put(
    "/:id",
    authRole([Role.ADMIN]),
    consultationController.updateConsultation.bind(consultationController)
);
router.delete(
    "/:id",
    authRole([Role.ADMIN]),
    consultationController.deleteConsultation.bind(consultationController)
);
router.delete("/", authRole([Role.ADMIN]), consultationController.deleteCourseByIds.bind(consultationController))

export default router;

// src/routes/social.routes.ts
import { Router } from "express";
import { SocialController } from "@controllers/social.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";

const router = Router();
const socialController = new SocialController();

router.post("/", authRole([Role.ADMIN]), socialController.create.bind(socialController));
router.get("/", socialController.list.bind(socialController));
router.get("/:id", socialController.getById.bind(socialController));
router.put("/:id", authRole([Role.ADMIN]), socialController.update.bind(socialController));
router.delete("/:id", authRole([Role.ADMIN]), socialController.remove.bind(socialController));

export default router;

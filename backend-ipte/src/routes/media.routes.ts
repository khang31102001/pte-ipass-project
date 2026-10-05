// src/routes/about.routes.ts
import { Router } from "express";
import { MediaController } from "@controllers/media.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";
import { upload } from "@middlewares/upload";

const router = Router();
const mediaController = new MediaController();

router.post(
    "/",
    authRole([Role.ADMIN]),
    upload.single("file"),
    mediaController.createMedia.bind(mediaController)
);
router.put(
    "/:id",
    authRole([Role.ADMIN]),
    upload.single("file"),
    mediaController.updateMedia.bind(mediaController)
);
router.get("/", mediaController.listMedia.bind(mediaController));

router.get("/:id", mediaController.getMediaById.bind(mediaController));

router.delete("/:id", authRole([Role.ADMIN]), mediaController.deleteMedia.bind(mediaController));

export default router;

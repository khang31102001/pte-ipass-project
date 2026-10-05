import { Router } from "express";

import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";
import { BannerController } from "@controllers/banner.controller";
import { upload } from "@middlewares/upload";

const router = Router();
const bannerController = new BannerController();

router.get("/", bannerController.getBanners.bind(bannerController));
router.post("/", authRole([Role.ADMIN]),upload.single("file"), bannerController.createBanner.bind(bannerController));
router.get("/:id", bannerController.getBannerById.bind(bannerController));
router.put("/:id", authRole([Role.ADMIN]), upload.single("file"), bannerController.updateBanner.bind(bannerController));
router.delete("/:id", authRole([Role.ADMIN]), bannerController.deleteBanner.bind(bannerController));
router.delete("/", authRole([Role.ADMIN]), bannerController.deleteBannersByIds.bind(bannerController));

export default router;

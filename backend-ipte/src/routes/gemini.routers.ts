import { Router } from "express";
import { GeminiController } from "@controllers/gemini.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";

const router = Router();
const geminiController = new GeminiController();

router.post(
    "/seo-evaluation",
    authRole([Role.ADMIN]),
    geminiController.evaluateSeo.bind(geminiController)
);

export default router;

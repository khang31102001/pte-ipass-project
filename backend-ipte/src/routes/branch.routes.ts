// src/routes/branch.routes.ts
import { Router } from "express";
import { BranchController } from "@controllers/branch.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";

const router = Router();
const branchController = new BranchController();

router.post("/", authRole([Role.ADMIN]), branchController.createBranch.bind(branchController));
router.get("/", branchController.list.bind(branchController));
router.get("/:id", branchController.getById.bind(branchController));
router.put("/:id", authRole([Role.ADMIN]), branchController.update.bind(branchController));
router.delete("/:id", authRole([Role.ADMIN]), branchController.remove.bind(branchController));

export default router;

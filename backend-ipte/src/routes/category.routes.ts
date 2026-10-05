import { Router } from "express";
import { CategoryController } from "@controllers/category.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";

const router = Router();
const categoryController = new CategoryController();

router.post("", authRole([Role.ADMIN]), categoryController.createCategory.bind(categoryController));

router.put(
    "/:id",
    authRole([Role.ADMIN]),
    categoryController.updateCategory.bind(categoryController)
);

router.delete(
    "/:id",
    authRole([Role.ADMIN]),
    categoryController.deleteCategory.bind(categoryController)
);


router.get("", categoryController.getCategories.bind(categoryController));

router.get("/header-menu", categoryController.getHeaderMenu.bind(categoryController));

router.get("/category-tree", categoryController.getCategoryTree.bind(categoryController));
router.get("/:id", categoryController.getCategoryById.bind(categoryController));
export default router;

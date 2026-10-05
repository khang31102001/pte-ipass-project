import { CategoryService } from "@services/category.service";
import { Request, Response } from "express";
import { camelCaseKeysDeep } from "@utils/response";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

export class CategoryController {
    private categoryService: CategoryService;
    constructor() {
        this.categoryService = new CategoryService();
    }

    async createCategory(req: Request, res: Response) {
        const categoryData = req.body;
        const newCategory = await CategoryService.createCategory(categoryData as any);
        await revalidate([TAGS.CATEGORIES]);
        res.status(201).json(camelCaseKeysDeep(newCategory));
    }

    async updateCategory(req: Request, res: Response) {
        const categoryId = Number(req.params.id);
        const categoryData = req.body;
        const updatedCategory = await CategoryService.updateCategory(categoryId, categoryData);
        await revalidate([TAGS.CATEGORIES]);
        res.json(camelCaseKeysDeep(updatedCategory));
    }

    async deleteCategory(req: Request, res: Response) {
        const categoryId = Number(req.params.id);
        if (Number.isNaN(categoryId)) {
            res.status(400).json({ message: "Invalid category id." });
            return;
        }

        try {
            await CategoryService.deleteCategory(categoryId);
            await revalidate([TAGS.CATEGORIES]);
            res.status(204).end();
        } catch (error: any) {
            if (error?.message === "CATEGORY_NOT_FOUND") {
                res.status(404).json({ message: "Category not found." });
                return;
            }
            res.status(500).json({ message: "Failed to delete category." });
        }
    }

    async getCategories(req: Request, res: Response) {
        const {
            categoryName,
            categoryType,
            slug,
            url,
            level,
            parentId,
            parentCategoryType,
            page,
            pageSize,
        } = req.query;

        const categories = await CategoryService.getCategories({
            categoryName: categoryName as string | undefined,
            categoryType: categoryType as string | undefined,
            slug: slug as string | undefined,
            url: url as string | undefined,
            level: level ? Number(level) : undefined,
            parentId: parentId ? Number(parentId) : undefined,
            parentCategoryType: parentCategoryType as string | undefined,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
        });
        res.json(camelCaseKeysDeep(categories));
    }

    async getCategoryById(req: Request, res: Response) {
        try {
            const categoryId = Number(req.params.id);
            if (Number.isNaN(categoryId)) {
                res.status(400).json({ message: "Invalid category id." });
                return;
            }
            const category = await CategoryService.getCategoryById(categoryId);
            res.status(200).json(camelCaseKeysDeep(category));
        } catch (e: any) {
            return res.status(500).json({ message: "Failed to get Category." });
        }
    }

    async getHeaderMenu(req: Request, res: Response) {
        const menu = await this.categoryService.getHeaderMenu();
        res.json(camelCaseKeysDeep(menu));
    }

    async getCategoryTree(req: Request, res: Response) {
        const { url, slug, categoryType, name } = req.query;
        const urlOrSlug = (slug as string | undefined) ?? (url as string | undefined);
        const categoryTree = await CategoryService.getCategoryTree(
            urlOrSlug as string | undefined,
            categoryType as string | undefined,
            name as string | undefined
        );
        res.json(camelCaseKeysDeep(categoryTree));
    }
}

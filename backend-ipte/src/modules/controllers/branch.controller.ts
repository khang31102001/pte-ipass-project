import { Request, Response } from "express";
import { BranchService } from "@services/branch.service";
import { camelCaseKeysDeep } from "@utils/response";
import { parseJsonField } from "@utils/requestParser";
import { BranchDTO } from "@dto/BranchDTO";
import { revalidate } from "@services/revalidate.service";
import { TAGS } from "@constaints/constaint"

export class BranchController {
    async createBranch(req: Request, res: Response) {
        let payload: Partial<BranchDTO>;
        try {
            payload = parseJsonField<Partial<BranchDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const created = await BranchService.createBranch(payload);
            await revalidate([TAGS.BRANCHES]);
            res.status(201).json(camelCaseKeysDeep(created));
        } catch (e) {
            res.status(500).json({ message: "Failed to create branch." });
        }
    }

    async getById(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid branch_id." });
        try {
            const data = await BranchService.getById(id);
            res.json(camelCaseKeysDeep(data));
        } catch (e: any) {
            if (e?.message === "BRANCH_NOT_FOUND")
                return res.status(404).json({ message: "Branch not found." });
            res.status(500).json({ message: "Failed to get branch." });
        }
    }

    async list(req: Request, res: Response) {
        try {
            const { q, category, categoryType, page, pageSize } = req.query;
            const result = await BranchService.list({
                categoryType: (categoryType ?? category) as string | undefined,
                q: q as string | undefined,
                page: page ? Number(page) : undefined,
                page_size: pageSize ? Number(pageSize) : undefined,
            });
            res.json(camelCaseKeysDeep(result));
        } catch (e) {
            res.status(500).json({ message: "Failed to list branches." });
        }
    }

    async update(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid branch_id." });
        let payload: Partial<BranchDTO>;
        try {
            payload = parseJsonField<Partial<BranchDTO>>(req);
        } catch {
            return res.status(400).json({ message: "Invalid request payload." });
        }
        try {
            const updated = await BranchService.update(id, payload);
            await revalidate([TAGS.BRANCHES]);
            res.json(camelCaseKeysDeep(updated));
        } catch (e: any) {
            if (e?.message === "BRANCH_NOT_FOUND")
                return res.status(404).json({ message: "Branch not found." });
            res.status(500).json({ message: "Failed to update branch." });
        }
    }

    async remove(req: Request, res: Response) {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid branch_id." });
        try {
            await BranchService.remove(id);
            await revalidate([TAGS.BRANCHES]);
            res.status(204).send();
        } catch (e: any) {
            if (e?.message === "BRANCH_NOT_FOUND")
                return res.status(404).json({ message: "Branch not found." });
            res.status(500).json({ message: "Failed to delete branch." });
        }
    }
}

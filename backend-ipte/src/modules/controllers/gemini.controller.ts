import { Request, Response } from "express";
import { evaluateSeo } from "@services/seoEvaluator.service";
import { SeoEvaluationInput } from "@dto/SeoEvaluationInput";

export class GeminiController {
    async evaluateSeo(req: Request, res: Response): Promise<void> {
        try {
            const data = req.body as SeoEvaluationInput;

            if (!data || !data.content) {
                res.status(400).json({
                    error: "Missing required fields: content",
                });
                return;
            }

            const result = await evaluateSeo(data);

            res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            console.error("SEO evaluation error:", error);

            res.status(500).json({
                success: false,
                error: "Failed to evaluate SEO",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
}

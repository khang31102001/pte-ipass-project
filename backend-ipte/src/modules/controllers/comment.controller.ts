import { Request, Response } from "express";

import { CommentService } from "@services/comment.service";

export class CommentController {
    private commentService: CommentService;

    constructor() {
        this.commentService = new CommentService();
    }

    async create(req: Request, res: Response) {
        try {
            const payload = {
                knowledgeId: this.toOptionalNumber(req.body.knowledgeId),
                newsId: this.toOptionalNumber(req.body.newsId),
                courseId: this.toOptionalNumber(req.body.courseId),
                userId: this.toOptionalNumber(req.body.userId),
                userName: req.body.userName,
                userAvatar: req.body.userAvatar,
                content: req.body.content,
                rating: this.toOptionalNumber(req.body.rating),
                likes: this.toOptionalNumber(req.body.likes),
                parentCommentId: this.toOptionalNumber(req.body.parentCommentId),
            };

            const comment = await this.commentService.createComment(payload);
            return res.status(201).json(comment);
        } catch (e: any) {
            if (e?.message === "COMMENT_TARGET_REQUIRED") {
                return res.status(400).json({ message: "knowledgeId, newsId or courseId is required." });
            }
            if (e?.message === "COMMENT_CONTENT_REQUIRED") {
                return res.status(400).json({ message: "content is required." });
            }
            return res.status(500).json({ message: "Failed to create comment." });
        }
    }

    async getComments(req: Request, res: Response) {
        try {
            const target = {
                knowledgeId: this.toOptionalNumber(req.query.knowledgeId as string),
                newsId: this.toOptionalNumber(req.query.newsId as string),
                courseId: this.toOptionalNumber(req.query.courseId as string),
            };
            const pagination = {
                page: this.toOptionalNumber(req.query.page as string),
                pageSize: this.toOptionalNumber(req.query.pageSize as string),
            };

            const data = await this.commentService.getComments(target, pagination);
            return res.json(data);
        } catch (e: any) {
            if (e?.message === "COMMENT_TARGET_REQUIRED") {
                return res.status(400).json({ message: "knowledgeId, newsId or courseId is required." });
            }
            return res.status(500).json({ message: "Failed to fetch comments." });
        }
    }

    private toOptionalNumber(input: unknown): number | undefined {
        if (input === undefined || input === null || input === "") return undefined;
        const num = Number(input);
        return Number.isNaN(num) ? undefined : num;
    }
}

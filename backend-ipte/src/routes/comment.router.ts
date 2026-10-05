import { Router } from "express";

import { CommentController } from "@controllers/comment.controller";

const router = Router();
const commentController = new CommentController();

router.post("/", commentController.create.bind(commentController));
router.get("/", commentController.getComments.bind(commentController));

export default router;

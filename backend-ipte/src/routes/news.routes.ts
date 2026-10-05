import { Router } from "express";
import { NewsController } from "@controllers/news.controller";
import { upload } from "@middlewares/upload";

const router = Router();
const newsController = new NewsController();

router.get("/detail", newsController.getNewsDetail.bind(newsController));
router.get("/news-and-tips", newsController.getNewsAndTips.bind(newsController));

router.get("/", newsController.getAllNews.bind(newsController));
router.post("/", upload.single("file"), newsController.createNews.bind(newsController));
router.get("/:id", newsController.getNewsById.bind(newsController));
router.put("/:id", upload.single("file"), newsController.updateNews.bind(newsController));
router.delete("/:id", newsController.deleteNews.bind(newsController));
router.delete("/", newsController.deleteNewsByIds.bind(newsController));

export default router;

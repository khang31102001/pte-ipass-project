import { DocumentController } from "@controllers/document.controller";
import { Router } from "express";
import { upload } from "@middlewares/upload";

const router = Router();

const documentController = new DocumentController();

router.get("/detail", documentController.getDocumentDetail.bind(documentController));

router.get("/", documentController.getDocuments.bind(documentController));
router.post("/", upload.single("file"), documentController.createDocument.bind(documentController));

router.get("/:categoryId", documentController.selectDocuments.bind(documentController));
router.put("/:id", upload.single("file"), documentController.updateDocument.bind(documentController));
router.delete("/:id", documentController.deleteDocument.bind(documentController));
router.delete("/", documentController.deleteDocumentByIds.bind(documentController));

export default router;

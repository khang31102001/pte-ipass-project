import { Router } from "express";

import { MailController } from "@controllers/mail.controller";

const router = Router();
const mailController = new MailController();

router.post("/send-email", mailController.sendEmail.bind(mailController));

export default router;

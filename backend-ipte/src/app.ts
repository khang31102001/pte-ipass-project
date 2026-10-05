import express, { Express } from "express";
import cors from "cors";
import path from "path";

import { config } from "@config/index";
import { setupSwagger } from "@config/swagger";
import errorHandler from "@middlewares/errorHandler";

import userRoutes from "@routes/user.routes";
import authRoutes from "@routes/auth.routes";
import aboutRoutes from "@routes/about.routes";
import branchRoutes from "@routes/branch.routes";
import socialRoutes from "@routes/social.routes";
import courseRoutes from "@routes/course.routes";
import teacherRoutes from "@routes/teacher.routes";
import studentRoutes from "@routes/student.routes";
import newsRoutes from "@routes/news.routes";
import bannerRoutes from "@routes/banner.routes";
import consultationRoutes from "@routes/consultation.routes";
import documentRoutes from "@routes/document.routes";
import categoryRoutes from "@routes/category.routes";
import geminiRoutes from "@routes/gemini.routers";
import commentRoutes from "@routes/comment.router";
import mediaRoutes from "@routes/media.routes";
import mailRoutes from "@routes/mail.routes";

const app: Express = express();

const allowedOrigins = config.CORS_ALLOWED_ORIGINS;

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true, // allow sending refresh token cookies
    })
);
app.use(express.json({ limit: "20mb" }));

// Serve static files from storage directory
app.use("/storage", express.static(path.join(process.cwd(), "storage")));

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/abouts", aboutRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/socials", socialRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/mail", mailRoutes);
app.use(errorHandler);

app.get("/", (_req, res) => {
    res.send("Welcome to the IPTE Backend API");
});
(BigInt.prototype as any).toJSON = function () {
    return Number(this);
};
setupSwagger(app);

export default app;

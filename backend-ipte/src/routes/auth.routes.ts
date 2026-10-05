// src/routes/auth.routes.ts
import { Router } from "express";
import { AuthController } from "@controllers/auth.controller";

const router = Router();
const authController = new AuthController();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication & Authorization
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     description: Đăng nhập và nhận access/refresh token.
 *       Có thể đăng nhập bằng `usernameOrEmail`, hoặc `username`, hoặc `email`.
 *       Tham số `deviceName` là tuỳ chọn để hiển thị tên thiết bị.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               usernameOrEmail:
 *                 type: string
 *                 description: Username hoặc email
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *               deviceName:
 *                 type: string
 *                 description: Tên thiết bị (optional)
 *           examples:
 *             sample:
 *               value:
 *                 usernameOrEmail: "admin"
 *                 password: "admin123"
 *                 deviceName: "Chrome on MacOS"
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Thiếu tham số
 *       401:
 *         description: Invalid credentials
 */

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout (current session)
 *     description: Đăng nhập và nhận access/refresh token. Có thể đăng nhập bằng `usernameOrEmail`, hoặc `username`, hoặc `email`. Tham số `deviceName` là tuỳ chọn để hiển thị tên thiết bị.
 *     parameters:
 *       - in: cookie
 *         name: rt
 *         required: false
 *         schema:
 *           type: string
 *         description: Refresh token lưu trong cookie
 *     responses:
 *       204:
 *         description: Logged out successfully (no content)
 */

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token & refresh token
 *     description: Cấp lại access token và refresh token khi refresh token hợp lệ.
 *       Refresh token được truyền qua cookie `rt`.
 *     parameters:
 *       - in: cookie
 *         name: rt
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh token lưu trong cookie
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Thiếu refresh token
 *       401:
 *         description: Invalid refresh token
 */

/**
 * @openapi
 * /api/auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Logout all sessions (tùy chọn)
 *     description: Đăng xuất toàn bộ phiên (tất cả thiết bị) của user hiện tại.
 *       Cần userId từ middleware auth hoặc body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *     responses:
 *       204:
 *         description: Logged out from all sessions successfully
 *       400:
 *         description: Thiếu userId
 */

router.post("/login", (req, res) => authController.login(req, res));
router.post("/logout", (req, res) => authController.logout(req, res));
router.post("/refresh", (req, res) => authController.refreshToken(req, res));

export default router;

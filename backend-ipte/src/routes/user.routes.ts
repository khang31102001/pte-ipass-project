import { Router } from "express";
import { UserController } from "@controllers/user.controller";
import { authRole } from "@middlewares/authorization";
import { Role } from "@enums/role.enum";

const router = Router();
const userController = new UserController();

/**
 * @openapi
 * tags:
 *   - name: User
 *     description: Quản lý người dùng
 */

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [User]
 *     summary: Get all users
 *     description: Lấy danh sách tất cả người dùng (chỉ ADMIN).
 *     responses:
 *       200:
 *         description: Danh sách user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch users
 *   post:
 *     tags: [User]
 *     summary: Create a new user
 *     description: Tạo mới một user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               fullName:
 *                 type: string
 *               avatar:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               teacherId:
 *                 type: integer
 *               bio:
 *                 type: string
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *               overallScore:
 *                 type: number
 *               listeningScore:
 *                 type: number
 *               speakingScore:
 *                 type: number
 *               readingScore:
 *                 type: number
 *               writingScore:
 *                 type: number
 *               slug:
 *                 type: string
 *               address:
 *                 type: string
 *               roleId:
 *                 type: integer
 *                 description: ID của role (mặc định là USER nếu không truyền)
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       500:
 *         description: Failed to create user
 */

/**
 * @openapi
 * /api/users/password:
 *   post:
 *     tags: [User]
 *     summary: Update password by username
 *     description: Update a user password by username.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, oldPassword, newPassword]
 *             properties:
 *               username:
 *                 type: string
 *               oldPassword:
 *                 type: string
 *                 minLength: 6
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Old password is incorrect
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to update password
 */

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [User]
 *     summary: Get current user profile
 *     description: Lấy thông tin user hiện tại dựa trên access token.
 *     responses:
 *       200:
 *         description: User info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to fetch user
 */

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [User]
 *     summary: Get user by ID
 *     description: Lấy thông tin user theo ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to fetch user
 *   put:
 *     tags: [User]
 *     summary: Update user by ID
 *     description: Cập nhật thông tin user theo ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *               fullName:
 *                 type: string
 *               avatar:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               teacherId:
 *                 type: integer
 *               bio:
 *                 type: string
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *               overallScore:
 *                 type: number
 *               listeningScore:
 *                 type: number
 *               speakingScore:
 *                 type: number
 *               readingScore:
 *                 type: number
 *               writingScore:
 *                 type: number
 *               slug:
 *                 type: string
 *               address:
 *                 type: string
 *               roleId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to update user
 *   delete:
 *     tags: [User]
 *     summary: Delete user by ID
 *     description: Xóa user theo ID (chỉ ADMIN).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to delete user
 */

router.get("/", authRole([Role.ADMIN]), (req, res) => userController.getAllUsers(req, res));
router.get("/me", authRole([Role.ADMIN]), (req, res) => userController.getMe(req, res));
router.get("/:id", (req, res) => userController.getUserById(req, res));
router.post("/", authRole([Role.ADMIN]), (req, res) => userController.createUser(req, res));
router.post("/password", authRole([Role.ADMIN]), (req, res) => userController.updatePassword(req, res));
router.put("/:id", (req, res) => userController.updateUser(req, res));
router.delete("/:id", authRole([Role.ADMIN]), (req, res) => userController.deleteUser(req, res));

export default router;

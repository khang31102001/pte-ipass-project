import { Request, Response } from "express";
import { UserService } from "@services/user.service";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import { getUserIdFromRequest } from "@utils/jwt";
import { camelCaseKeysDeep } from "@utils/response";

const userService = new UserService();

export class UserController {
    // Lấy danh sách tất cả user
    async getAllUsers(req: Request, res: Response): Promise<void> {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const pageSize = Math.max(1, Math.min(Number(req.query.page_size) || 20, 100));
            const { username, email, fullName, isActive } = req.query;
            const users = await userService.getAllUsers({
                username: username as string | undefined,
                email: email as string | undefined,
                fullName: fullName as string | undefined,
                isActive: isActive !== undefined ? Boolean(Number(isActive)) : undefined,
                page,
                pageSize,
            });
            res.status(200).json(camelCaseKeysDeep(users));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch users",
                error: error.message,
            });
        }
    }

    // Lấy user theo ID
    async getUserById(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const user = await userService.getUserById(id);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            const { password, ...userWithoutPassword } = user; 
            res.status(200).json(camelCaseKeysDeep(userWithoutPassword));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch user",
                error: error.message,
            });
        }
    }

    // Tạo mới user
    async createUser(req: Request, res: Response): Promise<void> {
        try {
            const { user_id, userId, id, ...data } = req.body;
            const newUser = await userService.registerUser(data);
            res.status(201).json(camelCaseKeysDeep(newUser));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to create user",
                error: error.message,
            });
        }
    }

    // Cập nhật user
    async updateUser(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const updatedUser = await userService.updateUser(id, req.body);

            if (!updatedUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            res.status(200).json(camelCaseKeysDeep(updatedUser));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to update user",
                error: error.message,
            });
        }
    }

    async updatePassword(req: Request, res: Response): Promise<void> {
        try {
            const { username, oldPassword, newPassword } = req.body;
            if (!username || !oldPassword || !newPassword) {
                res.status(400).json({ message: "Missing username, oldPassword, or newPassword" });
                return;
            }

            const updatedUser = await userService.updatePasswordByUsername(
                username,
                oldPassword,
                newPassword
            );
            if (!updatedUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            res.status(200).json({ message: "Password updated successfully" });
        } catch (error: any) {
            if (error?.message === "INVALID_OLD_PASSWORD") {
                res.status(400).json({ message: "Old password is incorrect" });
                return;
            }
            res.status(500).json({
                message: "Failed to update password",
                error: error.message,
            });
        }
    }

    // Xóa user
    async deleteUser(req: Request, res: Response): Promise<void> {
        try {
            const id = Number(req.params.id);
            const deletedUser = await userService.deleteUser(id);

            if (!deletedUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            res.status(200).json({ message: "User deleted successfully" });
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to delete user",
                error: error.message,
            });
        }
    }

    async getMe(req: Request, res: Response): Promise<void> {
        try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const user = await userService.getUserById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            const { password, ...userWithoutPassword } = user; 
            res.status(200).json(camelCaseKeysDeep(userWithoutPassword));
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to fetch user",
                error: error.message,
            });
        }
    }
}

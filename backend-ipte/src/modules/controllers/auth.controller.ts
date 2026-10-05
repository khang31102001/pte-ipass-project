// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { AuthService } from "@services/auth.service";

function getCookie(req: Request, name: string): string | undefined {
    // Nếu bạn đã dùng cookie-parser, có thể dùng: return req.cookies?.[name];
    // Fallback nhỏ nếu chưa bật cookie-parser:
    const header = req.headers.cookie;
    if (!header) return undefined;
    const map = Object.fromEntries(
        header.split(";").map((c) => {
            const [k, ...rest] = c.trim().split("=");
            return [k, rest.join("=")];
        })
    );
    return (map[name] as string) || undefined;
}

export class AuthController {
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { username, email, usernameOrEmail, password, deviceName } = req.body;

            const credential: string | undefined = usernameOrEmail ?? username ?? email;
            if (!credential || !password) {
                res.status(400).json({
                    message: "Thiếu tham số: cần usernameOrEmail (hoặc username/email) và password",
                });
                return;
            }

            const tokens = await AuthService.login(
                {
                    usernameOrEmail: credential,
                    password,
                    deviceName: deviceName ?? null, // tuỳ chọn, client gửi để hiển thị
                },
                req,
                res
            );

            res.status(200).json(tokens);
        } catch (err: any) {
            // 401 để tránh lộ lý do chi tiết
            res.status(401).json({ message: "Invalid credentials" });
        }
    }

    async refreshToken(req: Request, res: Response): Promise<void> {
        try {
            const refreshToken = getCookie(req, "rt");
            if (!refreshToken) {
                res.status(400).json({
                    message: "Thiếu cookie refresh token (rt)",
                });
                return;
            }

            const tokens = await AuthService.refreshToken(refreshToken, req, res);
            res.status(200).json(tokens);
        } catch (err: any) {
            res.status(401).json({ message: "Invalid refresh token" });
        }
    }

    /**
     * Logout chỉ phiên hiện tại (thiết bị hiện tại):
     * - Đọc refresh token từ cookie rt
     * - Revoke toàn bộ refresh token thuộc session_id hiện tại
     * - Xoá cookie rt
     * - Trả 204 (idempotent)
     */
    async logout(req: Request, res: Response): Promise<void> {
        try {
            const refreshToken = getCookie(req, "rt");
            await AuthService.logoutCurrentSession(refreshToken);

            res.clearCookie("rt", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/auth/refresh",
            });

            res.status(204).end();
        } catch {
            // Idempotent: vẫn trả 204
            res.status(204).end();
        }
    }

    /**
     * Tuỳ chọn: logout tất cả phiên (tất cả thiết bị) của user hiện tại
     * Yêu cầu có middleware auth để gắn req.user.id hoặc truyền userId trong body theo ý bạn.
     */
    async logoutAll(req: Request, res: Response): Promise<void> {
        try {
            const userId: number | undefined = (req as any).user?.id ?? req.body?.userId;
            if (!userId) {
                res.status(400).json({ message: "Thiếu userId" });
                return;
            }
            await AuthService.revokeRefreshTokensForUser(userId);
            res.clearCookie("rt", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/auth/refresh",
            });
            res.status(204).end();
        } catch {
            res.status(204).end();
        }
    }
}

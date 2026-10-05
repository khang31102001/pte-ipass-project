// src/services/auth.service.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken, hashToken, verifyToken } from "@utils/jwt";
import { randomUUID } from "crypto";
import { Request, Response } from "express";

const prisma = new PrismaClient();

const ACCESS_SEC_FALLBACK = 10 * 60; // 10 phút (nếu signAccessToken không tự set)
const REFRESH_SEC = Number(process.env.JWT_REFRESH_EXPIRES) || 30 * 24 * 3600; // 30 ngày mặc định

type LoginDTO = {
    usernameOrEmail: string;
    password: string;
    deviceName?: string | null;
};

export type OAuth2TokenResponse = {
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
    refresh_token: string;
    scope?: string;
};

function getClientInfo(req: Request) {
    // Chỉ dùng để hiển thị/audit; không xác định danh tính
    const userAgent = req.get("user-agent") ?? null;
    // Nếu bạn có reverse proxy, nhớ app.set('trust proxy', 1) ở app.ts
    const ip = (req.ip || "").toString() || null;
    const deviceName =
        (req.body?.deviceName as string | undefined) ??
        (req.header("x-device-name") as string | undefined) ??
        null;
    return { userAgent, ip, deviceName };
}

export class AuthService {
    /**
     * Đăng nhập: tạo session_id mới (thiết bị mới), cấp access + refresh,
     * lưu refresh (hash) kèm jti, session_id, user_agent, ip, ...
     */
    static async login(input: LoginDTO, req: Request, res: Response): Promise<OAuth2TokenResponse> {
        const { usernameOrEmail, password } = input;

        // 1) Tìm user theo username hoặc email
        const user = await prisma.user.findFirst({
            where: {
                OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
            },
            include: {
                user_role: { include: { role: true } },
            },
        });

        if (!user) throw new Error("Invalid credentials");

        // 2) So sánh mật khẩu
        const ok = bcrypt.compareSync(password, user.password);
        if (!ok) throw new Error("Invalid credentials");

        // 3) Chuẩn bị claims
        const roles = (user.user_role ?? []).map((ur) => ur.role.role_name);
        const roleIds = (user.user_role ?? []).map((ur) => ur.role_id);
        const sessionId = randomUUID(); // mỗi login = 1 phiên mới (thiết bị mới)
        const jti = randomUUID();

        // 4) Ký token
        const { token: accessToken, expiresIn: accessExpiresInRaw } = signAccessToken({
            sub: user.user_id,
            username: user.username,
            email: user.email,
            roles,
            roleIds,
            jti,
            sid: sessionId, // đưa sid vào access để đồng bộ
        });

        const { token: refreshToken } = signRefreshToken({
            sub: user.user_id,
            username: user.username,
            email: user.email,
            jti,
            sid: sessionId, // rất quan trọng cho rotation & logout theo phiên
        });

        // 5) Lưu refresh token (hash) vào DB
        const { userAgent, ip, deviceName } = getClientInfo(req);

        await prisma.refresh_token.create({
            data: {
                user_id: user.user_id,
                jti,
                token_hash: hashToken(refreshToken),
                session_id: sessionId,
                device_name: deviceName,
                user_agent: userAgent,
                ip,
                expires_at: new Date(Date.now() + REFRESH_SEC * 1000),
            },
        });

        // 6) Set cookie rt
        res.cookie("rt", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: REFRESH_SEC * 1000,
        });

        // 7) Trả response OAuth2
        return {
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: accessExpiresInRaw || ACCESS_SEC_FALLBACK,
            refresh_token: refreshToken,
            scope: roles.join(" "),
        };
    }

    /**
     * Refresh + Rotation:
     * - Verify refresh
     * - Đối chiếu jti trong DB + KHỚP token_hash (tăng an toàn)
     * - Revoke token cũ, tạo token mới giữ nguyên session_id
     * - Set cookie rt mới
     */
    static async refreshToken(
        refreshToken: string,
        req: Request,
        res: Response
    ): Promise<OAuth2TokenResponse> {
        // 1) Xác thực chữ ký & parse payload
        const payload = verifyToken(refreshToken, "refresh"); // throw nếu sai
        const {
            sub: userId,
            jti,
            sid,
        } = payload as {
            sub: number;
            jti: string;
            sid: string;
        };
        if (!userId || !jti || !sid) throw new Error("Invalid refresh token");

        // 2) Kiểm tra DB
        const stored = await prisma.refresh_token.findFirst({
            where: { jti },
        });
        if (!stored || stored.revoked_at) throw new Error("Invalid refresh token");
        if (stored.expires_at < new Date()) throw new Error("Refresh token expired");

        // Khớp hash để tránh ai đó đoán jti
        const sameHash = stored.token_hash === hashToken(refreshToken);
        if (!sameHash) {
            // Token bị tái sử dụng/tráo đổi → revoke cả phiên
            await prisma.refresh_token.updateMany({
                where: { session_id: stored.session_id, revoked_at: null },
                data: { revoked_at: new Date() },
            });
            throw new Error("Invalid refresh token");
        }

        // 3) Tìm user & roles
        const user = await prisma.user.findUnique({
            where: { user_id: userId },
            include: {
                user_role: { include: { role: true } },
            },
        });
        if (!user) throw new Error("Invalid refresh token");
        const roles = (user.user_role ?? []).map((ur) => ur.role.role_name);

        // 4) Rotate: tạo jti mới, ký access + refresh mới (giữ nguyên sid)
        const newJti = randomUUID();
        const { token: newAccess, expiresIn: accessExpiresInRaw } = signAccessToken({
            sub: user.user_id,
            username: user.username,
            email: user.email,
            roles,
            jti: newJti,
            sid, // giữ nguyên session_id
        });

        const { token: newRefresh } = signRefreshToken({
            sub: user.user_id,
            username: user.username,
            email: user.email,
            jti: newJti,
            sid,
        });

        // 5) Transaction: revoke cũ, create mới
        const { userAgent, ip } = getClientInfo(req);
        await prisma.$transaction([
            prisma.refresh_token.updateMany({
                where: { jti },
                data: { revoked_at: new Date(), last_used_at: new Date() },
            }),
            prisma.refresh_token.create({
                data: {
                    user_id: user.user_id,
                    jti: newJti,
                    token_hash: hashToken(newRefresh),
                    session_id: stored.session_id,
                    device_name: stored.device_name,
                    user_agent: userAgent ?? stored.user_agent,
                    ip: ip ?? stored.ip,
                    expires_at: new Date(Date.now() + REFRESH_SEC * 1000),
                },
            }),
        ]);

        // 6) Set cookie rt mới
        res.cookie("rt", newRefresh, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: REFRESH_SEC * 1000,
        });

        // 7) Trả OAuth2
        return {
            access_token: newAccess,
            token_type: "Bearer",
            expires_in: accessExpiresInRaw || ACCESS_SEC_FALLBACK,
            refresh_token: newRefresh,
            scope: roles.join(" "),
        };
    }

    /**
     * Logout phiên hiện tại (dựa trên refresh token cookie):
     * - Nếu không có/không hợp lệ: coi như đã logout → idempotent
     * - Nếu hợp lệ: revoke toàn bộ refresh token cùng session_id
     */
    static async logoutCurrentSession(refreshToken?: string | null) {
        if (!refreshToken) return;

        try {
            const payload = verifyToken(refreshToken, "refresh");
            const { jti } = payload as { jti: string };
            if (!jti) return;

            const rec = await prisma.refresh_token.findFirst({
                where: { jti },
            });
            if (!rec || rec.revoked_at) return;

            await prisma.refresh_token.updateMany({
                where: { session_id: rec.session_id, revoked_at: null },
                data: { revoked_at: new Date() },
            });
        } catch {
            // nuốt lỗi để đảm bảo idempotent
            return;
        }
    }

    /**
     * Revoke tất cả refresh token đang hoạt động của 1 user (logout all devices)
     */
    static async revokeRefreshTokensForUser(userId: number): Promise<void> {
        await prisma.refresh_token.updateMany({
            where: {
                user_id: userId,
                revoked_at: null,
                expires_at: { gt: new Date() },
            },
            data: { revoked_at: new Date() },
        });
    }
}

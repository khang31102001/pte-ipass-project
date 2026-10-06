import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { authenticateAllowTemp, clientIp } from "../../auth/middleware";
import { env, isProd } from "../../config/env";
import { handler } from "../../core/http/async";
import { unauthorized } from "../../core/http/errors";
import { ok } from "../../core/http/response";
import { parseBody } from "../../core/http/validate";
import { changePassword, changePasswordSchema, login, loginSchema, logout, refresh, toSession, type LoginResult } from "./auth.service";

const COOKIE = "ipte_refresh";

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : isProd,
  sameSite: (isProd ? "strict" : "lax") as "strict" | "lax",
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_DAYS * 86_400_000,
});

const client = (req: Request) => ({ ip: clientIp(req), userAgent: req.get("user-agent") ?? undefined });
const refreshCookie = (req: Request) => (req.cookies as Record<string, string> | undefined)?.[COOKIE];

function respond(res: Response, result: LoginResult) {
  res.cookie(COOKIE, result.refreshToken, cookieOptions());
  return ok(res, { accessToken: result.accessToken, expiresIn: result.expiresIn, ...result.session });
}

/** Giới hạn tốc độ đăng nhập theo IP (chống dò mật khẩu hàng loạt). */
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, data: null, message: "Quá nhiều lần thử, vui lòng thử lại sau", errors: [], code: "TOO_MANY_REQUESTS" });
  },
});

export const authRouter = Router();

authRouter.post(
  "/login",
  loginLimiter,
  handler(async (req, res) => respond(res, await login(parseBody(loginSchema, req.body), client(req)))),
);

authRouter.post(
  "/refresh",
  handler(async (req, res) => respond(res, await refresh(refreshCookie(req), client(req)))),
);

authRouter.post(
  "/logout",
  handler(async (req, res) => {
    await logout(refreshCookie(req));
    res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
    return ok(res, null, { message: "Đã đăng xuất" });
  }),
);

/** Phiên hiện tại: { user, role, permissions[] } (contract của AuthAdapter phía FE). */
authRouter.get(
  "/me",
  authenticateAllowTemp,
  handler(async (req, res) => {
    if (!req.auth) throw unauthorized();
    return ok(res, await toSession(req.auth.userId));
  }),
);

authRouter.post(
  "/change-password",
  authenticateAllowTemp,
  handler(async (req, res) => {
    if (!req.auth) throw unauthorized();
    await changePassword(req.auth, parseBody(changePasswordSchema, req.body));
    res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
    return ok(res, null, { message: "Đã đổi mật khẩu, vui lòng đăng nhập lại" });
  }),
);

import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";

/**
 * Data for signing JWT
 */
export type SignInput = {
    sub: string | number;
    username: string;
    email: string;
    jti?: string;
    sid?: string; // session_id
    roles?: string[];
    roleIds?: number[];
    permissions?: string[];
};

/**
 * ecoded JWT payload
 */
export type DecodedToken = JwtPayload & {
    sub: string | number;
    username: string;
    email: string;
    jti: string;
    sid?: string;
    roles?: string[];
    roleIds?: number[];
    permissions?: string[];
    typ: "access" | "refresh";
};

/**
 * Sign Access Token
 */
export function signAccessToken(payload: SignInput) {
    const secret = process.env.JWT_ACCESS_SECRET!;
    const expiresIn = Number(process.env.JWT_ACCESS_EXPIRES || 900); // default 15 phút

    const token = jwt.sign(
        {
            sub: payload.sub,
            username: payload.username,
            email: payload.email,
            roles: payload.roles ?? [],
            roleIds: payload.roleIds ?? [],
            permissions: payload.permissions ?? [],
            jti: payload.jti,
            sid: payload.sid,
            typ: "access",
        },
        secret,
        { expiresIn }
    );

    return { token, expiresIn };
}

/**
 * Sign Refresh Token
 */
export function signRefreshToken(payload: SignInput) {
    const secret = process.env.JWT_REFRESH_SECRET!;
    const expiresIn = Number(process.env.JWT_REFRESH_EXPIRES || 2592000); // default 30 ngày

    const token = jwt.sign(
        {
            sub: payload.sub,
            username: payload.username,
            email: payload.email,
            jti: payload.jti,
            sid: payload.sid,
            typ: "refresh",
        },
        secret,
        { expiresIn }
    );

    return { token, expiresIn };
}

/**
 * Verify + parse JWT
 * - Check signature
 * - Check typ (access/refresh)
 */
export function verifyToken(token: string, expectedType: "access" | "refresh"): DecodedToken {
    const secret =
        expectedType === "access"
            ? process.env.JWT_ACCESS_SECRET!
            : process.env.JWT_REFRESH_SECRET!;

    let decoded: any;
    try {
        decoded = jwt.verify(token, secret);
    } catch {
        throw new Error("Invalid token");
    }

    if (!decoded || typeof decoded !== "object") {
        throw new Error("Invalid token");
    }

    if (decoded.typ !== expectedType) {
        throw new Error("Token type mismatch");
    }

    return decoded as DecodedToken;
}

/**
 * Hash token (using save hashed refresh token in DB)
 */
export function hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function decodeToken(token: string): DecodedToken | null {
    try {
        const decoded = jwt.decode(token);
        if (decoded && typeof decoded === "object") {
            return decoded as DecodedToken;
        }
        return null;
    } catch {
        return null;
    }
}

export function getTokenFromHeader(req: any): string | null {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.split(" ")[1];
    }
    return null;
}

export function getUserIdFromRequest(req: any): number | null {
    const token = getTokenFromHeader(req);
    if (!token) return null;
    try {
        const decoded = verifyToken(token, "access");
        return Number(decoded.sub);
    } catch {
        return null;
    }
}

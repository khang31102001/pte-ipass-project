import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessClaims {
  sub: string;
  /** tokenVersion của user tại thời điểm cấp; lệch ⇒ token bị thu hồi. */
  tv: number;
}

export const signAccessToken = (claims: AccessClaims): string =>
  jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
    issuer: "ipte-api",
    audience: "ipte-web",
  });

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"], issuer: "ipte-api", audience: "ipte-web" });
  if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded["tv"] !== "number") throw new Error("Invalid token claims");
  return { sub: decoded.sub, tv: decoded["tv"] };
}

/** Refresh token là chuỗi ngẫu nhiên (opaque); DB chỉ lưu SHA-256. */
export const newRefreshToken = () => randomBytes(48).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newFamilyId = () => randomUUID();

export const accessTtlSeconds = (): number => {
  const m = /^(\d+)([smhd])$/.exec(env.JWT_ACCESS_EXPIRES);
  if (!m) return 900;
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as "s" | "m" | "h" | "d"];
  return Number(m[1]) * unit;
};

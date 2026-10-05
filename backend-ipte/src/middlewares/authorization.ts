import { Request, Response, NextFunction } from "express";
import { verifyToken, DecodedToken } from "@utils/jwt";
import { getPermissionsByRoleIds, getPermissionsByUserId } from "@services/permissions.service";
import { Role } from "@enums/role.enum";

/**
 * Middleware checks if the user has one of the allowed roles.
 * @param allowedRoles - roles permitted to access the route:
 *   authRole([Role.ADMIN, Role.MANAGER])
 */
export function authRole(allowedRoles: Role[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).json({ message: "Access denied. No token provided." });
            }

            const token = authHeader.split(" ")[1];
            const decoded = verifyToken(token, "access") as DecodedToken;

            if (!decoded.roles || !Array.isArray(decoded.roles)) {
                return res.status(403).json({ message: "Forbidden. Roles missing." });
            }

            const hasRole = decoded.roles.some((r) => allowedRoles.includes(r as Role));
            if (!hasRole) {
                return res.status(403).json({ message: "Forbidden. Insufficient role." });
            }

            (req as any).user = decoded;
            next();
        } catch {
            return res.status(401).json({ message: "Invalid or expired token." });
        }
    };
}

/**
 * checks if the user has at least one of the required permissions.
 * @param allowedPermissions - list of permission codes required to access the route
 * @example router.get("/users", authPermission(["CREATE_POST"]), handler)
 */
export function authPermission(allowedPermissions: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return res.status(401).json({ message: "Access denied. No token provided." });
            }

            const token = authHeader.split(" ")[1];
            const decoded = verifyToken(token, "access") as DecodedToken;

            let perms: string[] = [];
            if (decoded.roleIds && decoded.roleIds.length > 0) {
                // Lấy permission theo roleIds từ token (nhanh hơn)
                perms = await getPermissionsByRoleIds(decoded.roleIds);
            } else {
                // Fallback: lấy theo user_id
                const userId = Number(decoded.sub);
                perms = await getPermissionsByUserId(userId);
            }

            const ok = allowedPermissions.some((p) => perms.includes(p));
            if (!ok) {
                return res.status(403).json({ message: "Forbidden. Insufficient permission." });
            }

            (req as any).user = decoded;
            next();
        } catch (err) {
            return res.status(401).json({ message: "Invalid or expired token." });
        }
    };
}

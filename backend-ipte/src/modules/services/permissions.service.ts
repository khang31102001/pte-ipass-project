import prisma from "@config/database";

/**
 * Get permissions by role IDs.
 * return unique permission names.
 */
export async function getPermissionsByRoleIds(roleIds: number[]): Promise<string[]> {
    if (!roleIds || roleIds.length === 0) return [];

    const rows = await prisma.role_permission.findMany({
        where: { role_id: { in: roleIds } },
        select: { permission: { select: { permission_name: true } } },
    });

    // unique
    const set = new Set(rows.map((r) => r.permission.permission_name));
    return Array.from(set);
}

/**
 * Fallback: Get permissions by user ID.
 * return unique permission names.
 */
export async function getPermissionsByUserId(userId: number): Promise<string[]> {
    const rows = await prisma.role_permission.findMany({
        where: { role: { user_role: { some: { user_id: userId } } } },
        select: { permission: { select: { permission_name: true } } },
    });

    const set = new Set(rows.map((r) => r.permission.permission_name));
    return Array.from(set);
}

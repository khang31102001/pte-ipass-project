import { UserDAO } from "@dao/user.dao";
import { Prisma, user } from "@prisma/client";
import bcrypt from "bcryptjs";

type CreateUserInput = {
    username: string;
    email: string;
    password: string;
    fullName?: string;
    avatar?: string | null;
    isActive?: boolean;
    teacherId?: number | null;
    bio?: string | null;
    slug?: string | null;
    address?: string | null;
    roleId?: number;
    createdBy?: string | null;
    updatedBy?: string | null;
};

type UpdateUserInput = {
    username?: string;
    email?: string;
    fullName?: string;
    avatar?: string | null;
    isActive?: boolean;
    teacherId?: number | null;
    bio?: string | null;
    slug?: string | null;
    address?: string | null;
    updatedBy?: string | null;
};

export class UserService {
    private userDao: UserDAO;

    constructor() {
        this.userDao = new UserDAO();
    }

    async getUserById(id: number): Promise<user | null> {
        return this.userDao.findById(id);
    }

    async getUserByEmail(email: string): Promise<user | null> {
        return this.userDao.findByEmail(email);
    }

    async getUserByUsername(username: string): Promise<user | null> {
        return this.userDao.findByUsername(username);
    }

    async getAllUsers(filters: {
        username?: string;
        email?: string;
        fullName?: string;
        isActive?: boolean;
        page: number;
        pageSize: number;
    }): Promise<{
        items: user[];
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    }> {
        return this.userDao.findAll(filters);
    }

    async registerUser(input: CreateUserInput): Promise<user> {
        const passwordHash = bcrypt.hashSync(input.password, 10);
        const data = normalizeCreateInput({ ...input, password: passwordHash });
        return this.userDao.create(data);
    }

    async updateUser(id: number, input: UpdateUserInput): Promise<user | null> {
        const existing = await this.userDao.findById(id);
        if (!existing) {
            return null;
        }
        const data = normalizeUpdateInput({ ...input });
        return this.userDao.update(id, data);
    }

    async updatePasswordByUsername(
        username: string,
        oldPassword: string,
        newPassword: string
    ): Promise<user | null> {
        const existing = await this.userDao.findByUsername(username);
        if (!existing) {
            return null;
        }

        const isMatch = bcrypt.compareSync(oldPassword, existing.password);
        if (!isMatch) {
            throw new Error("INVALID_OLD_PASSWORD");
        }

        const passwordHash = bcrypt.hashSync(newPassword, 10);
        return this.userDao.updateByUsername(username, {
            password: passwordHash,
            updated_at: new Date(),
            updated_by: "system",
            version: { increment: 1 },
        });
    }

    async deleteUser(id: number): Promise<user> {
        return this.userDao.delete(id);
    }
}

function normalizeCreateInput(input: CreateUserInput & { password: string }): Prisma.userCreateInput {
    const data: Prisma.userCreateInput = {
        username: input.username,
        email: input.email,
        password: input.password,
        ...(input.fullName !== undefined && { full_name: input.fullName }),
        ...(input.avatar !== undefined && { avatar: input.avatar }),
        ...(input.isActive !== undefined && { is_active: input.isActive }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.address !== undefined && { address: input.address }),
        created_by: input.createdBy || "system",
        updated_by: input.updatedBy || "system",
        version: 1,
        ...(input.roleId != null && {
            user_role: {
                create: [
                    {
                        created_by: input.createdBy || "system",
                        updated_by: input.updatedBy || "system",
                        version: 1,
                        role: {
                            connect: {
                                role_id: input.roleId,
                            },
                        },
                    },
                ],
            },
        }),
    };
    return data;
}

function normalizeUpdateInput(input: UpdateUserInput & { password?: string }): Prisma.userUpdateInput {
    const data: Prisma.userUpdateInput = {
        ...(input.username !== undefined && { username: input.username }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.fullName !== undefined && { full_name: input.fullName }),
        ...(input.avatar !== undefined && { avatar: input.avatar }),
        ...(input.isActive !== undefined && { is_active: input.isActive }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.address !== undefined && { address: input.address }),
        updated_at: new Date(),
        updated_by: input.updatedBy || "system",
        version: { increment: 1 },
    };
    return data;
}

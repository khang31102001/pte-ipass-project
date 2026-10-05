import prisma from "@config/database";
import { Prisma } from "@prisma/client";

export type CommentTarget = {
    knowledgeId?: number;
    newsId?: number;
    courseId?: number;
};

export type CreateCommentData = CommentTarget & {
    userId?: number;
    userName?: string;
    userAvatar?: string;
    content: string;
    rating?: number;
    likes?: number;
    parentCommentId?: number;
};

export type CommentRecord = {
    comment_id: number;
    user_id: number | null;
    course_id: number | null;
    news_id: number | null;
    knowledge_id: number | null;
    parent_comment_id: number | null;
    content: string;
    rating: number | null;
    likes: number | null;
    user_name: string | null;
    user_avatar: string | null;
    created_at: Date;
};

export class CommentDAO {
    private buildTargetCondition(target: CommentTarget): Prisma.Sql {
        const conditions: Prisma.Sql[] = [];

        if (target.knowledgeId !== undefined) {
            conditions.push(Prisma.sql`knowledge_id = ${target.knowledgeId}`);
        }
        if (target.newsId !== undefined) {
            conditions.push(Prisma.sql`news_id = ${target.newsId}`);
        }
        if (target.courseId !== undefined) {
            conditions.push(Prisma.sql`course_id = ${target.courseId}`);
        }

        if (!conditions.length) {
            throw new Error("COMMENT_TARGET_REQUIRED");
        }

        return Prisma.join(conditions, " AND ");
    }

    async create(data: CreateCommentData): Promise<CommentRecord> {
        const rows = await prisma.$queryRaw<CommentRecord[]>(Prisma.sql`
            INSERT INTO "comment" (
                user_id,
                course_id,
                news_id,
                knowledge_id,
                parent_comment_id,
                content,
                rating,
                likes,
                user_name,
                user_avatar
            )
            VALUES (
                ${data.userId ?? null},
                ${data.courseId ?? null},
                ${data.newsId ?? null},
                ${data.knowledgeId ?? null},
                ${data.parentCommentId ?? null},
                ${data.content},
                ${data.rating ?? null},
                ${data.likes ?? 0},
                ${data.userName ?? null},
                ${data.userAvatar ?? null}
            )
            RETURNING
                comment_id,
                user_id,
                course_id,
                news_id,
                knowledge_id,
                parent_comment_id,
                content,
                rating,
                likes,
                user_name,
                user_avatar,
                created_at
        `);

        return rows[0];
    }

    async getAllByTarget(target: CommentTarget): Promise<CommentRecord[]> {
        const whereClause = this.buildTargetCondition(target);

        return prisma.$queryRaw<CommentRecord[]>(Prisma.sql`
            SELECT
                comment_id,
                user_id,
                course_id,
                news_id,
                knowledge_id,
                parent_comment_id,
                content,
                rating,
                likes,
                user_name,
                user_avatar,
                created_at
            FROM "comment"
            WHERE ${whereClause}
            ORDER BY created_at ASC
        `);
    }

    async countTopLevel(target: CommentTarget): Promise<number> {
        const whereClause = this.buildTargetCondition(target);

        const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM "comment"
            WHERE ${whereClause} AND parent_comment_id IS NULL
        `);

        return Number(rows[0]?.count ?? 0);
    }
}

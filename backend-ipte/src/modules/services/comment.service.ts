import {
    CommentDAO,
    CommentRecord,
    CommentTarget,
    CreateCommentData,
} from "@dao/comment.dao";

export type CommentNode = {
    commentId: number;
    knowledgeId: number | null;
    newsId: number | null;
    courseId: number | null;
    userId: number | null;
    userName: string | null;
    userAvatar: string | null;
    content: string;
    rating: number | null;
    likes: number;
    replies: CommentNode[];
};

type Pagination = {
    page?: number;
    pageSize?: number;
};

export class CommentService {
    private commentDAO: CommentDAO;

    constructor() {
        this.commentDAO = new CommentDAO();
    }

    async createComment(payload: CreateCommentData): Promise<CommentNode> {
        if (!payload.content || !payload.content.trim()) {
            throw new Error("COMMENT_CONTENT_REQUIRED");
        }
        if (!payload.knowledgeId && !payload.newsId && !payload.courseId) {
            throw new Error("COMMENT_TARGET_REQUIRED");
        }

        const created = await this.commentDAO.create(payload);
        return this.toResponseNode(created);
    }

    async getComments(target: CommentTarget, pagination: Pagination) {
        if (!target.knowledgeId && !target.newsId && !target.courseId) {
            throw new Error("COMMENT_TARGET_REQUIRED");
        }

        const page = pagination.page && pagination.page > 0 ? pagination.page : 1;
        const pageSize = pagination.pageSize && pagination.pageSize > 0 ? pagination.pageSize : 20;

        const [allComments, totalTopLevel] = await Promise.all([
            this.commentDAO.getAllByTarget(target),
            this.commentDAO.countTopLevel(target),
        ]);

        const topLevelSorted = allComments
            .filter((c) => c.parent_comment_id === null)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const offset = (page - 1) * pageSize;
        const selectedTop = topLevelSorted.slice(offset, offset + pageSize);
        const selectedTopIds = new Set(selectedTop.map((c) => c.comment_id));

        const items = this.buildTree(allComments, selectedTopIds, selectedTop);

        return {
            items,
            page,
            pageSize,
            total: totalTopLevel,
            totalPages: Math.max(1, Math.ceil(totalTopLevel / pageSize)),
        };
    }

    private buildTree(
        allComments: CommentRecord[],
        selectedTopIds: Set<number>,
        selectedTop: CommentRecord[]
    ): CommentNode[] {
        // Sort oldest first so replies preserve chronological order when attached.
        const sortedByOldest = [...allComments].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        const nodeMap = new Map<number, CommentNode>();
        sortedByOldest.forEach((row) => {
            nodeMap.set(row.comment_id, this.toResponseNode(row));
        });

        const roots: CommentNode[] = [];
        sortedByOldest.forEach((row) => {
            const node = nodeMap.get(row.comment_id)!;
            if (row.parent_comment_id && nodeMap.has(row.parent_comment_id)) {
                nodeMap.get(row.parent_comment_id)!.replies.push(node);
            } else if (selectedTopIds.has(row.comment_id)) {
                roots.push(node);
            }
        });

        const ordering = selectedTop.map((c) => c.comment_id);
        roots.sort((a, b) => ordering.indexOf(a.commentId) - ordering.indexOf(b.commentId));

        return roots;
    }

    private toResponseNode(row: CommentRecord): CommentNode {
        return {
            commentId: row.comment_id,
            knowledgeId: row.knowledge_id,
            newsId: row.news_id,
            courseId: row.course_id,
            userId: row.user_id,
            userName: row.user_name,
            userAvatar: row.user_avatar,
            content: row.content,
            rating: row.rating,
            likes: row.likes ?? 0,
            replies: [],
        };
    }
}

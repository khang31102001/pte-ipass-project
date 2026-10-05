export type SocialDTO = {
    socialId?: number;
    categoryType?: string | null;
    title?: string;
    description?: string | null;
    url?: string | null;

    createdAt?: string;
    updatedAt?: string;

    createdBy?: string | null;
    updatedBy?: string | null;

    version?: number;
};

export function mapToSocialDTO(entity: any): SocialDTO {
    return {
        socialId: entity.information_id,
        categoryType: entity.category_type,
        title: entity.title,
        description: entity.description,
        url: entity.social_url,
        createdAt: entity.created_at ? entity.created_at.toISOString() : undefined,
        updatedAt: entity.updated_at ? entity.updated_at.toISOString() : undefined,
        createdBy: entity.created_by,
        updatedBy: entity.updated_by,
        version: entity.version,
    };
}

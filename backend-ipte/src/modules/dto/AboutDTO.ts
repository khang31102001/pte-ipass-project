export type AboutDTO = {
    aboutId?: number;

    categoryType?: string | null;

    slug?: string;
    image?: string | null;
    title?: string;
    description?: string | null;
    content?: string | null;

    mission?: string | null;
    vision?: string | null;

    createdAt?: string;
    updatedAt?: string;

    createdBy?: string | null;
    updatedBy?: string | null;

    version?: number;

    deleteImageUrl?: string | null;
    isImageChanged?: boolean | null;
    isImageChage?: boolean | null;

    video?: string | null;
};

export function mapToAboutDTO(entity: any): AboutDTO {
    return {
        aboutId: entity.information_id,
        categoryType: entity.category_type,
        slug: entity.slug,
        image: entity.image,
        title: entity.title,
        description: entity.description,
        content: entity.content,
        mission: entity.mission,
        vision: entity.vision,
        deleteImageUrl: entity.delete_image_url ?? null,
        video: entity.video ?? null,
        createdAt: entity.created_at ? entity.created_at.toISOString() : undefined,
        updatedAt: entity.updated_at ? entity.updated_at.toISOString() : undefined,
        createdBy: entity.created_by,
        updatedBy: entity.updated_by,
        version: entity.version,
    };
}

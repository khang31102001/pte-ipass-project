export type MediaDTO = {
    id?: number;
    title?: string;
    description?: string | null;
    imageName?: string | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    mediaType?: string | null;
    deleteImageUrl: string | null;
    isDisabled?: boolean | null;
    categoryId?: number | null;
    categoryType?: string | null;
    isImageChanged: boolean | null;
    href?: string | null;

    createdAt?: string;
    updatedAt?: string;
    createdBy?: string | null;
    updatedBy?: string | null;
    version?: number;
};

export function mapFromMediaToMediaDTO(data: any): MediaDTO {
    return {
        id: data.media_id,
        title: data.title,
        description: data.description,
        imageName: data.image_name,
        imageUrl: data.image_url,
        videoUrl: data.video_url,
        deleteImageUrl: data.delete_image_url,
        mediaType: data.media_type,
        categoryId: data.category_id,
        categoryType: data.category_type,
        isDisabled: data.is_disabled,

        isImageChanged: null,

        href: data.href,
        
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        createdBy: data.created_by,
        updatedBy: data.updated_by,
        version: data.version,
    };
}

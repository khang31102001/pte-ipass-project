export interface BannerDTO {
    bannerId?: number | null;
    title: string;
    subtitle: string;
    placement: string;
    actionType: string;
    actionLabel: string;
    actionUrl?: string | null;
    image?: string | null;
    deleteImageUrl?: string | null;
    isActive?: boolean | null;
    order?: number | null;
    startAt?: string | null;
    endAt?: string | null;
    isImageChanged?: boolean | null;
    createdBy?: string | null;
    updatedBy?: string | null;
    categoryId: number;
}

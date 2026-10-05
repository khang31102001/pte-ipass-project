export type BranchDTO = {
    branchId?: number;

    slug?: string;
    title?: string;
    description?: string | null;
    phone?: string | null;
    hotline?: string | null;
    email?: string | null;

    address?: string | null;
    mapUrl?: string | null;

    categoryType?: string | null;

    createdAt?: string;
    updatedAt?: string;

    createdBy?: string | null;
    updatedBy?: string | null;

    version?: number;
};

export function mapToBranchDTO(entity: any): BranchDTO {
    return {
        branchId: entity.information_id,
        slug: entity.slug,
        title: entity.title,
        description: entity.description,
        address: entity.address,
        mapUrl: entity.map_url,
        phone: entity.phone,
        hotline: entity.hotline,
        email: entity.email,
        categoryType: entity.category_type,
        createdAt: entity.created_at ? entity.created_at.toISOString() : undefined,
        updatedAt: entity.updated_at ? entity.updated_at.toISOString() : undefined,
        createdBy: entity.created_by,
        updatedBy: entity.updated_by,
        version: entity.version,
    };
}

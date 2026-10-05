export interface CategoryRequestDTO {
    categoryId?: number; // serial4
    icon?: string | null;
    name: string; // varchar(200)
    slug: string; // varchar(200)
    description?: string | null;
    parentId?: number | null; // int8
    categoryType: string; // varchar(50)
    metaTitle?: string | null; // varchar(255)
    metaDescription?: string | null; // text
    h1Heading?: string | null; // varchar(255)
    seoContentTop?: string | null; // text
    seoContentBottom?: string | null; // text
    canonicalUrl?: string | null; // text
    noindex?: boolean; // bool
    url?: string | null; // text
    level?: number | null; // int4
    isFeatured?: boolean; // bool
    isDisable?: boolean; // bool
    createdAt?: string | Date; // timestamp
    updatedAt?: string | Date; // timestamp
    createdBy?: string | null; // varchar(50)
    updatedBy?: string | null; // varchar(50)
    version?: number; // int4
}

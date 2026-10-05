import { deleted_image } from "@prisma/client";

import prisma from "@config/database";

export class DeletedImageDAO {
    async create(deleteImageUrl: string): Promise<deleted_image> {
        return await prisma.deleted_image.create({
            data: {
                delete_image_url: deleteImageUrl,
            },
        });
    }
}
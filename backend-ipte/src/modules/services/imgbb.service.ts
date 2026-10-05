import { config } from "@config/index";

type UploadOptions = {
    fileName?: string;
};

export type ImgbbResponse = {
    data?: {
        id?: string;
        url?: string;
        display_url?: string;
        delete_url?: string;
        thumb?: { url?: string };
        image?: { url?: string };
    };
    success?: boolean;
    status?: number;
    error?: {
        message?: string;
    };
};

export class ImgbbService {
    private static ensureConfig() {
        if (!config.IMGBB_API_KEY) {
            throw new Error("IMGBB_API_KEY_MISSING");
        }
        if (!config.IMGBB_URL_UPLOAD) {
            throw new Error("IMGBB_URL_UPLOAD_MISSING");
        }
    }

    private static stripDataUri(image: string): string {
        const matches = image.match(/^data:(.+);base64,(.*)$/);
        if (matches && matches[2]) {
            return matches[2];
        }
        return image;
    }

    private static isDataUri(image?: string | null): boolean {
        if (!image) return false;
        return /^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(image);
    }

    static async uploadFromInput(
        imageInput?: string | null,
        file?: Express.Multer.File,
        options: UploadOptions = {}
    ): Promise<ImgbbResponse | undefined> {
        if (file && file.buffer?.length) {
            return this.uploadBuffer(file.buffer, options.fileName ?? file.originalname);
        }
        if (imageInput) {
            if (this.isDataUri(imageInput)) {
                return this.uploadBase64(imageInput, options.fileName);
            }
        }
        return undefined;
    }

    static async uploadBuffer(buffer: Buffer, fileName?: string): Promise<ImgbbResponse> {
        const base64 = buffer.toString("base64");
        return this.uploadBase64(base64, fileName);
    }

    static async uploadBase64(imageBase64: string, fileName?: string): Promise<ImgbbResponse> {
        this.ensureConfig();
        const uploadUrl = config.IMGBB_URL_UPLOAD;
        const formData = new FormData();
        formData.append("key", config.IMGBB_API_KEY);
        formData.append("image", this.stripDataUri(imageBase64));
        if (fileName) {
            formData.append("name", fileName);
        }

        const response = await fetch(uploadUrl, {
            method: "POST",
            body: formData as any,
        });
        const json = (await response.json()) as ImgbbResponse;

        if (!response.ok || !json?.data?.display_url) {
            const message =
                json?.error?.message ||
                `IMGBB_UPLOAD_FAILED_${response.status || json?.status || "UNKNOWN"}`;
            throw new Error(message);
        }

        const res = {
            data: {
                display_url: json.data?.image?.url || json.data?.display_url,
                delete_url: json.data?.delete_url,
            }
        }

        return res;
    }

    static async deleteByDeleteUrl(deleteUrl: string): Promise<boolean> {
        this.ensureConfig();
        try {
            const response = await fetch(deleteUrl, {
                method: "GET",
            });
            return response.ok;
        } catch (err) {
            console.error("Error deleting image from IMGBB:", err);
            return false;
        }
    }
}

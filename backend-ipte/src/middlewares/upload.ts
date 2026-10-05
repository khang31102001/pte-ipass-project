import multer from "multer";

const MB = 1024 * 1024;

const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fieldSize: 40 * MB,
        fileSize: 5 * MB, // 5MB
    },
});

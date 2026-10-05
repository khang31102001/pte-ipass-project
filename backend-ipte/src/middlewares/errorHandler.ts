import { Request, Response, NextFunction } from "express";

// đặt ở cuối cùng sau tất cả route
function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    // log ra console
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.error("Error message:", err.message);
    console.error("Stack:", err.stack);

    // trả về response JSON gọn gàng
    res.status(err.status || 500).json({
        message: err.message || "Internal Server Error",
    });
}

export default errorHandler;

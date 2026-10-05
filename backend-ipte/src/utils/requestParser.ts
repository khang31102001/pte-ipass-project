import { Request } from "express";

export function parseJsonField<T>(req: Request, fieldName = "request"): T {
    const body: any = req.body ?? {};
    const raw = body[fieldName];

    if (raw === undefined) {
        return body as T;
    }

    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as T;
        } catch (err) {
            throw new Error("INVALID_JSON_PAYLOAD");
        }
    }

    return raw as T;
}

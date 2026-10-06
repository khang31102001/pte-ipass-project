import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Bọc handler async để lỗi đi vào error middleware. */
export const handler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

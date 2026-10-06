import { Router } from "express";
import { authenticate, requirePermission } from "../../auth/middleware";
import type { Permission, Resource } from "../../contract/permissions";
import { handler } from "../http/async";
import { notFound } from "../http/errors";
import { created, ok } from "../http/response";
import type { CrudService } from "./crud.service";
import { parseListParams } from "./list-query";

export interface CrudRouteOptions {
  exportable?: boolean;
  /** Tắt bớt thao tác (resource chỉ đọc, hoặc không cho xóa). */
  only?: readonly ("list" | "get" | "create" | "update" | "delete")[];
  label: string;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const perm = (resource: Resource, action: string) => `${resource}.${action}` as Permission;

/**
 * Router REST chuẩn: GET /, GET /export, GET /:id, POST /, PUT|PATCH /:id, DELETE /:id.
 * Quyền kiểm tra tại từng route (resource.action), độc lập với FE.
 */
export function crudRouter<TDto, TInput>(resource: Resource, service: CrudService<TDto, TInput>, options: CrudRouteOptions): Router {
  const router = Router();
  const enabled = (op: NonNullable<CrudRouteOptions["only"]>[number]) => !options.only || options.only.includes(op);
  router.use(authenticate);
  // Id sai định dạng UUID ⇒ 404 (tránh lỗi 500 từ Postgres).
  router.param("id", (_req, _res, next, id: string) => (UUID.test(id) ? next() : next(notFound(`Không tìm thấy ${options.label}`))));

  if (enabled("list")) {
    router.get(
      "/",
      requirePermission(perm(resource, "view")),
      handler(async (req, res) => {
        const { items, meta } = await service.list(parseListParams(req), req.auth);
        return ok(res, items, { meta });
      }),
    );
  }

  if (options.exportable) {
    router.get(
      "/export",
      requirePermission(perm(resource, "export")),
      handler(async (req, res) => ok(res, await service.export(parseListParams(req, { pageSize: 5000 }), req.auth))),
    );
  }

  if (enabled("get")) {
    router.get(
      "/:id",
      requirePermission(perm(resource, "view")),
      handler(async (req, res) => ok(res, await service.get(String(req.params["id"]), req.auth))),
    );
  }

  if (enabled("create")) {
    router.post(
      "/",
      requirePermission(perm(resource, "create")),
      handler(async (req, res) => created(res, await service.create(req.body, req.auth))),
    );
  }

  if (enabled("update")) {
    const update = handler(async (req, res) => ok(res, await service.update(String(req.params["id"]), req.body, req.auth)));
    router.put("/:id", requirePermission(perm(resource, "edit")), update);
    router.patch("/:id", requirePermission(perm(resource, "edit")), update);
  }

  if (enabled("delete")) {
    router.delete(
      "/:id",
      requirePermission(perm(resource, "delete")),
      handler(async (req, res) => {
        await service.remove(String(req.params["id"]), req.auth);
        return ok(res, null, { message: `Đã xóa ${options.label}` });
      }),
    );
  }

  return router;
}

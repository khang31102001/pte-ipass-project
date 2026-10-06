import type { Branch as BranchRow, Prisma, Room as RoomRow } from "@prisma/client";
import { branchSchema, roomSchema, type BranchInput, type RoomInput } from "../../contract/branches/schemas";
import type { Branch as BranchDto, Room as RoomDto } from "../../contract/branches/types";
import { crudRouter } from "../../core/crud/crud.router";
import { createCrudService } from "../../core/crud/crud.service";
import { compact, iso } from "../../core/crud/dto";
import { conflict } from "../../core/http/errors";

const include = { _count: { select: { rooms: true } } } satisfies Prisma.BranchInclude;
type BranchWithCount = Prisma.BranchGetPayload<{ include: typeof include }>;

const toBranchDto = (b: BranchWithCount): BranchDto =>
  compact({
    id: b.id,
    code: b.code,
    name: b.name,
    country: b.country,
    city: b.city,
    address: b.address,
    phone: b.phone,
    email: b.email ?? undefined,
    managerName: b.managerName ?? undefined,
    openingHours: b.openingHours ?? undefined,
    mapUrl: b.mapUrl ?? undefined,
    status: b.status,
    roomCount: b._count.rooms,
    createdAt: iso(b.createdAt),
    updatedAt: iso(b.updatedAt),
  });

const branchData = (i: BranchInput) => ({
  code: i.code,
  name: i.name,
  country: i.country,
  city: i.city,
  address: i.address,
  phone: i.phone,
  email: i.email ?? null,
  managerName: i.managerName ?? null,
  openingHours: i.openingHours ?? null,
  mapUrl: i.mapUrl ?? null,
  status: i.status,
});

export const branchService = createCrudService<BranchWithCount, BranchDto, BranchInput>({
  resource: "branch",
  label: "cơ sở",
  table: "branches",
  delegate: (db) => db.branch,
  include,
  schema: branchSchema,
  toDtos: (rows) => rows.map(toBranchDto),
  searchColumns: ["name", "code", "city", "address"],
  filters: { country: (v) => ({ country: v }), status: (v) => ({ status: v }) },
  sortable: { name: (d) => ({ name: d }), code: (d) => ({ code: d }), city: (d) => ({ city: d }), createdAt: (d) => ({ createdAt: d }), status: (d) => ({ status: d }) },
  defaultSort: { sortBy: "name", sortOrder: "asc" },
  entityLabel: (b) => b.name,
  uniqueFields: { code: { field: "code", message: "Mã cơ sở đã tồn tại" } },
  toCreateData: branchData,
  toUpdateData: branchData,
  beforeDelete: (b) => {
    if (b._count.rooms > 0) throw conflict("Cơ sở còn phòng học, hãy xóa/chuyển phòng trước");
  },
});

const toRoomDto = (r: RoomRow): RoomDto => ({
  id: r.id,
  branchId: r.branchId,
  name: r.name,
  capacity: r.capacity,
  type: r.type,
  status: r.status,
  equipment: r.equipment,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

const roomData = (i: RoomInput) => ({ branchId: i.branchId, name: i.name, capacity: i.capacity, type: i.type, status: i.status, equipment: i.equipment });

export const roomService = createCrudService<RoomRow, RoomDto, RoomInput>({
  resource: "branch",
  label: "phòng học",
  table: "rooms",
  delegate: (db) => db.room,
  schema: roomSchema,
  toDtos: (rows) => rows.map(toRoomDto),
  searchColumns: ["name"],
  filters: { branchId: (v) => ({ branchId: v }), type: (v) => ({ type: v }), status: (v) => ({ status: v }) },
  sortable: { name: (d) => ({ name: d }), capacity: (d) => ({ capacity: d }), createdAt: (d) => ({ createdAt: d }) },
  defaultSort: { sortBy: "name", sortOrder: "asc" },
  entityLabel: (r) => r.name,
  uniqueFields: { name: { field: "name", message: "Tên phòng đã tồn tại trong cơ sở này" }, branch_id: { field: "name", message: "Tên phòng đã tồn tại trong cơ sở này" } },
  toCreateData: roomData,
  toUpdateData: roomData,
});

export const branchesRouter = crudRouter("branch", branchService, { label: "cơ sở" });
export const roomsRouter = crudRouter("branch", roomService, { label: "phòng học" });

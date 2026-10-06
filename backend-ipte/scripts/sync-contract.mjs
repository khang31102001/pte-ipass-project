// Đồng bộ CONTRACT dùng chung từ FE sang BE để schema validation giống hệt nhau (nguồn sự thật: fe-pte-ipass).
// Chạy:  npm run contract:sync   (từ backend-ipte, FE nằm ở ../fe-pte-ipass)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FE = resolve(here, "../../fe-pte-ipass/src");
const OUT = resolve(here, "../src/contract");

if (!existsSync(FE)) throw new Error(`Không thấy FE tại ${FE}`);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const BANNER = "// GENERATED bởi scripts/sync-contract.mjs từ fe-pte-ipass — KHÔNG sửa tay. Sửa ở FE rồi chạy `npm run contract:sync`.\n";

const rewrite = (src, depthToRoot) => {
  const up = depthToRoot === 0 ? "." : Array(depthToRoot).fill("..").join("/");
  return src
    .replace(/from "@\/core\/validation"/g, `from "${up}/validation"`)
    .replace(/from "@\/core\/api"/g, `from "${up}/api"`)
    .replace(/from "@\/shared\/domain\/(\w+)"/g, `from "${up}/domain/$1"`)
    .replace(/from "@\/core\/rbac(\/permissions)?"/g, `from "${up}/permissions"`)
    .replace(/from "@\/features\/(\w[\w-]*)\/types"/g, `from "${up}/$1/types"`);
};

const write = (rel, content) => {
  const target = join(OUT, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, BANNER + content);
};

write("validation.ts", readFileSync(join(FE, "core/validation/index.ts"), "utf8"));
for (const f of ["pte", "content"]) write(`domain/${f}.ts`, readFileSync(join(FE, `shared/domain/${f}.ts`), "utf8"));
write("api.ts", `export interface BaseEntity { id: string; createdAt: string; updatedAt: string }
export type SortOrder = "asc" | "desc";
export interface ListQuery { page?: number; pageSize?: number; q?: string; sortBy?: string; sortOrder?: SortOrder }
`);

const features = readdirSync(join(FE, "features"), { withFileTypes: true }).filter((d) => d.isDirectory());
for (const dir of features) {
  for (const file of ["types.ts", "schemas.ts"]) {
    const path = join(FE, "features", dir.name, file);
    if (existsSync(path)) write(`${dir.name}/${file}`, rewrite(readFileSync(path, "utf8"), 1));
  }
}
// Các file ở thư mục gốc contract cần đường dẫn tương đối 0 cấp (domain/pte nhập lẫn nhau không dùng alias).
cpSync(join(FE, "core/rbac/permissions.ts"), join(OUT, "permissions.ts"));
writeFileSync(join(OUT, "permissions.ts"), BANNER + readFileSync(join(OUT, "permissions.ts"), "utf8"));
console.log(`Đã đồng bộ contract → ${OUT}`);

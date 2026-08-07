import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "modules/media/package.json",
  "modules/media/module.json",
  "modules/media/src/module.ts",
  "modules/media/src/application/media-service.ts",
  "modules/media/src/infrastructure/local-storage-adapter.ts",
  "modules/media/src/infrastructure/prisma-media-repository.ts",
  "modules/media/src/infrastructure/file-inspection.ts",
  "modules/media/src/api/routes.ts",
  "modules/media/tests/media-service.test.ts",
  "modules/media/tests/file-inspection.test.ts",
  "modules/media/tests/module.test.ts",
  "apps/admin/app/media/page.tsx",
  "packages/database/prisma/migrations/20260807000200_phase2_media/migration.sql",
  "scripts/verify-phase2.mjs",
  "PHASE2-VERIFICATION.md",
];
const failures = [];
for (const file of required) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!String(rootPackage.scripts?.["verify:phase2"] ?? "").includes("verify:phase1")) {
  failures.push("verify:phase2 must preserve and run the Phase 1 verifier");
}

const mediaPackage = JSON.parse(readFileSync(join(root, "modules/media/package.json"), "utf8"));
const mediaManifest = JSON.parse(readFileSync(join(root, "modules/media/module.json"), "utf8"));
for (const field of ["name", "version"]) {
  if (mediaPackage[field] !== mediaManifest[field]) {
    failures.push(`Media module ${field} differs between package.json and module.json`);
  }
}

const schema = readFileSync(join(root, "packages/database/prisma/schema.prisma"), "utf8");
if (!schema.includes("model MediaAsset ")) failures.push("Prisma model missing: MediaAsset");
if (!schema.includes("enum MediaKind ")) failures.push("Prisma enum missing: MediaKind");
for (const field of ["storageKey", "mimeType", "sizeBytes", "checksumSha256", "width", "height", "altText"]) {
  if (!schema.includes(field)) failures.push(`MediaAsset field missing: ${field}`);
}

const migration = readFileSync(
  join(root, "packages/database/prisma/migrations/20260807000200_phase2_media/migration.sql"),
  "utf8",
);
if (!migration.includes('CREATE TABLE "media_assets"')) failures.push("Phase 2 media_assets table is missing");
if (!migration.includes('CREATE TYPE "MediaKind"')) failures.push("Phase 2 MediaKind enum migration is missing");

const routeSource = readFileSync(join(root, "modules/media/src/api/routes.ts"), "utf8");
for (const route of [
  "/api/v1/admin/media",
  "/api/v1/admin/media/:id",
  "/api/v1/admin/media/:id/content",
]) {
  if (!routeSource.includes(route)) failures.push(`Media API route missing: ${route}`);
}
if (!routeSource.includes("multipart: true")) failures.push("Media upload route must use multipart upload");

const serviceSource = readFileSync(join(root, "modules/media/src/application/media-service.ts"), "utf8");
for (const capability of ["upload(", "content(", "update(", "delete("]) {
  if (!serviceSource.includes(capability)) failures.push(`Media service capability missing: ${capability}`);
}
for (const securityCheck of ["MEDIA_MIME_MISMATCH", "MEDIA_FILE_TOO_LARGE", "checksumSha256"]) {
  if (!serviceSource.includes(securityCheck)) failures.push(`Media upload validation missing: ${securityCheck}`);
}

const seed = readFileSync(join(root, "packages/database/prisma/seed-runner.ts"), "utf8");
for (const seeded of ["@beyondx/module-media", "media.assets.read", "media.assets.upload", "media.assets.update", "media.assets.delete"]) {
  if (!seed.includes(seeded)) failures.push(`Phase 2 seed requirement missing: ${seeded}`);
}

const config = readFileSync(join(root, "packages/config/src/index.ts"), "utf8");
for (const key of ["MEDIA_STORAGE_DRIVER", "MEDIA_LOCAL_ROOT", "MEDIA_MAX_FILE_SIZE_BYTES", "MEDIA_ALLOWED_MIME_TYPES"]) {
  if (!config.includes(key)) failures.push(`Media environment setting missing: ${key}`);
}

const docker = readFileSync(join(root, "docker-compose.yml"), "utf8");
if (!docker.includes("beyondx_media_data")) failures.push("Docker media persistence volume is missing");

const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
for (const importer of ["modules/media:", "apps/api:"]) {
  if (!lockfile.includes(importer)) failures.push(`Lockfile importer missing (${importer}); run pnpm install before Complete delivery`);
}
if (!lockfile.includes("@fastify/multipart")) {
  failures.push("Lockfile does not contain @fastify/multipart; run pnpm install before Complete delivery");
}

function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (["node_modules", "dist", ".next", "coverage", ".git", ".turbo"].includes(entry)) continue;
    if (statSync(path).isDirectory()) result.push(...walk(path));
    else result.push(path);
  }
  return result;
}

for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (rel === ".env" || /(^|\/)(node_modules|dist|\.next|coverage|\.turbo)(\/|$)/.test(rel)) {
    failures.push(`Forbidden output included: ${rel}`);
  }
}

if (failures.length) {
  console.error("Phase 2 verification failed\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Phase 2 Media Module structure verified successfully.");

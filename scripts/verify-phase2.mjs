import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "modules/content/package.json",
  "modules/content/module.json",
  "modules/content/src/module.ts",
  "modules/content/src/application/content-service.ts",
  "modules/content/src/infrastructure/prisma-content-repository.ts",
  "modules/content/src/api/routes.ts",
  "modules/content/tests/content-service.test.ts",
  "modules/content/tests/module.test.ts",
  "apps/admin/app/content/page.tsx",
  "apps/admin/app/content-types/page.tsx",
  "packages/database/prisma/migrations/20260807000100_phase2_content/migration.sql",
  "scripts/verify-phase2.mjs",
  "PHASE2-VERIFICATION.md",
];

const failures = [];
for (const file of required) if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);

const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!String(rootPackage.scripts?.["verify:phase2"] ?? "").includes("verify:phase1")) {
  failures.push("verify:phase2 must preserve and run the Phase 1 verifier");
}

const contentPackage = JSON.parse(readFileSync(join(root, "modules/content/package.json"), "utf8"));
const contentManifest = JSON.parse(readFileSync(join(root, "modules/content/module.json"), "utf8"));
for (const field of ["name", "version"]) {
  if (contentPackage[field] !== contentManifest[field]) failures.push(`Content module ${field} differs between package.json and module.json`);
}

const schema = readFileSync(join(root, "packages/database/prisma/schema.prisma"), "utf8");
for (const model of ["ContentType", "FieldDefinition", "ContentEntry", "ContentRevision", "EntryRelation"]) {
  if (!schema.includes(`model ${model} `)) failures.push(`Prisma model missing: ${model}`);
}
for (const state of ["DRAFT", "PUBLISHED", "ARCHIVED"]) {
  if (!schema.includes(state)) failures.push(`Content state missing: ${state}`);
}
if (!schema.includes("scheduledPublishAt")) failures.push("Publish scheduling field is missing");

const migration = readFileSync(join(root, "packages/database/prisma/migrations/20260807000100_phase2_content/migration.sql"), "utf8");
for (const table of ["content_types", "field_definitions", "content_entries", "content_revisions", "entry_relations"]) {
  if (!migration.includes(`CREATE TABLE \"${table}\"`)) failures.push(`Phase 2 migration table missing: ${table}`);
}

const routeSource = readFileSync(join(root, "modules/content/src/api/routes.ts"), "utf8");
for (const route of [
  "/api/v1/admin/content-types",
  "/api/v1/admin/content-entries",
  "/publish",
  "/unpublish",
  "/archive",
  "/schedule",
  "/revisions",
  "/api/v1/content/:apiId",
  "/api/v1/content/:apiId/:slug",
]) {
  if (!routeSource.includes(route)) failures.push(`Content API route missing: ${route}`);
}

const permissions = readFileSync(join(root, "modules/content/src/domain/permissions.ts"), "utf8");
for (const permission of ["content.types.read", "content.entries.create", "content.entries.publish", "content.revisions.read"]) {
  if (!permissions.includes(permission)) failures.push(`Content permission missing: ${permission}`);
}

const seed = readFileSync(join(root, "packages/database/prisma/seed-runner.ts"), "utf8");
if (!seed.includes("@beyondx/module-content")) failures.push("Content module is not seeded");
if (!seed.includes("CONTENT_SEED_PERMISSIONS")) failures.push("Content permissions are not seeded");

const runtime = readFileSync(join(root, "apps/api/src/runtime.ts"), "utf8");
if (!runtime.includes("new ContentModule")) failures.push("Content module is not registered in API runtime");

const shell = readFileSync(join(root, "apps/admin/components/admin-shell.tsx"), "utf8");
if (!shell.includes("/content") || !shell.includes("/content-types")) failures.push("Admin navigation is missing CMS pages");
const css = readFileSync(join(root, "apps/admin/app/globals.css"), "utf8");
if (!css.includes("Mobile-first application shell") || !css.includes("@media(min-width:900px)")) failures.push("Admin mobile-first responsive baseline is missing");

const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
if (!lockfile.includes("modules/content:")) failures.push("Lockfile importer missing (modules/content:); run pnpm install before Complete delivery");

function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (["node_modules", "dist", ".next", "coverage", ".git", ".turbo"].includes(entry)) continue;
    if (statSync(path).isDirectory()) result.push(...walk(path)); else result.push(path);
  }
  return result;
}
for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (rel === ".env" || /(^|\/)(node_modules|dist|\.next|coverage|\.turbo)(\/|$)/.test(rel)) failures.push(`Forbidden output included: ${rel}`);
}

if (failures.length) {
  console.error("Phase 2 verification failed\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Phase 2 structure verified successfully.");

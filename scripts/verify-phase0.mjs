import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "turbo.json", "tsconfig.base.json",
  "eslint.config.js", "prettier.config.mjs", "docker-compose.yml", "Dockerfile", ".env.example",
  "README.md", "CHANGELOG.md", "apps/api/src/app.ts", "apps/api/src/server.ts",
  "packages/core/package.json", "packages/database/package.json", "packages/events/package.json",
  "packages/module-system/package.json", "packages/config/package.json", "packages/logger/package.json",
  "packages/validation/package.json", "packages/testing/package.json",
  "packages/database/prisma/schema.prisma",
  "modules/foundation/package.json", "modules/foundation/module.json", "modules/foundation/src/module.ts",
  "packages/database/prisma/migrations/20260806000100_phase0_foundation/migration.sql"
];

const failures = [];
for (const file of required) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const lockfileText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
if (/importers:\s*\{\}/.test(lockfileText) || lockfileText.includes("Provisional lockfile")) {
  failures.push("pnpm-lock.yaml is provisional; run pnpm install to generate the resolved lockfile");
}

const workspaceText = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
for (const pattern of ["apps/*", "packages/*", "modules/*"]) {
  if (!workspaceText.includes(pattern)) failures.push(`Workspace pattern missing: ${pattern}`);
}

const packageFiles = [];
for (const parent of ["apps", "packages", "modules"]) {
  const dir = join(root, parent);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const packageFile = join(dir, name, "package.json");
    if (existsSync(packageFile)) packageFiles.push(packageFile);
  }
}

const apiPackage = JSON.parse(readFileSync(join(root, "apps/api/package.json"), "utf8"));
if (!apiPackage.scripts?.dev?.includes("--conditions=development")) {
  failures.push("API development script must enable the development export condition");
}
for (const file of packageFiles.filter((file) => !file.includes(`${join("apps")}`))) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  const developmentEntry = pkg.exports?.["."]?.development;
  if (developmentEntry !== "./src/index.ts") {
    failures.push(`${pkg.name} must expose ./src/index.ts under the development condition`);
  }
  if (!existsSync(join(file, "..", developmentEntry ?? "__missing__"))) {
    failures.push(`${pkg.name} development export does not exist: ${String(developmentEntry)}`);
  }
}

const foundationPackage = JSON.parse(readFileSync(join(root, "modules/foundation/package.json"), "utf8"));
const foundationManifest = JSON.parse(readFileSync(join(root, "modules/foundation/module.json"), "utf8"));
for (const field of ["name", "version"] ) {
  if (foundationPackage[field] !== foundationManifest[field]) {
    failures.push(`Foundation module ${field} differs between package.json and module.json`);
  }
}

const packageNames = new Set();
for (const file of packageFiles) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  if (typeof pkg.name !== "string" || !pkg.name.startsWith("@beyondx/")) {
    failures.push(`Invalid internal package name: ${relative(root, file)}`);
  } else if (packageNames.has(pkg.name)) {
    failures.push(`Duplicate package name: ${pkg.name}`);
  } else packageNames.add(pkg.name);
}
for (const file of packageFiles) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const [name, version] of Object.entries(pkg[section] ?? {})) {
      if (version === "workspace:*" && !packageNames.has(name)) {
        failures.push(`${pkg.name} references missing workspace package ${name}`);
      }
    }
  }
}

function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (["node_modules", "dist", ".next", "coverage", ".git"].includes(entry)) continue;
    if (statSync(path).isDirectory()) result.push(...walk(path)); else result.push(path);
  }
  return result;
}
for (const file of walk(root)) {
  const rel = relative(root, file);
  if (/(^|\/)(node_modules|dist|\.next|coverage)(\/|$)/.test(rel) || rel === ".env") {
    failures.push(`Forbidden output included: ${rel}`);
  }
  if (/\.(ts|tsx|js|mjs)$/.test(file)) {
    const source = readFileSync(file, "utf8");
    if (/\b(register|boot)\s*\([^)]*\)\s*\{\s*\}/.test(source)) failures.push(`Empty lifecycle method: ${rel}`);
    if (/echo\s+.*tests passed/i.test(source)) failures.push(`Placeholder test command/content: ${rel}`);
  }
}

const apiSource = readFileSync(join(root, "apps/api/src/app.ts"), "utf8");
const foundationRouteSource = readFileSync(join(root, "modules/foundation/src/api/platform-route.ts"), "utf8");
for (const route of ["/health", "/ready"]) {
  if (!apiSource.includes(route)) failures.push(`API route not registered: ${route}`);
}
if (!foundationRouteSource.includes("/api/v1/platform")) failures.push("Foundation module platform route is missing");
const serverSource = readFileSync(join(root, "apps/api/src/server.ts"), "utf8");
if (!serverSource.includes("SIGTERM") || !serverSource.includes("SIGINT")) failures.push("Graceful shutdown handlers are missing");
const migration = readFileSync(join(root, "packages/database/prisma/migrations/20260806000100_phase0_foundation/migration.sql"), "utf8");
if (!migration.includes("CREATE TABLE")) failures.push("Phase 0 migration does not create database objects");

if (failures.length > 0) {
  console.error("Phase 0 verification failed\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Phase 0 structure verified successfully (${packageFiles.length} workspace packages).`);

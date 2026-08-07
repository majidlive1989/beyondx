import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "apps/admin/package.json",
  "apps/admin/app/login/page.tsx",
  "apps/admin/app/dashboard/page.tsx",
  "apps/admin/app/profile/page.tsx",
  "apps/admin/app/users/page.tsx",
  "apps/admin/app/roles/page.tsx",
  "apps/admin/app/sessions/page.tsx",
  "apps/admin/app/audit/page.tsx",
  "apps/admin/app/reset-password/page.tsx",
  "apps/admin/app/verify-email/page.tsx",
  "modules/identity/package.json",
  "modules/identity/module.json",
  "modules/identity/src/module.ts",
  "modules/identity/src/application/identity-service.ts",
  "modules/identity/src/infrastructure/prisma-identity-repository.ts",
  "modules/identity/tests/crypto-services.test.ts",
  "modules/identity/tests/identity-service.test.ts",
  "modules/identity/tests/repository.integration.test.ts",
  "packages/database/prisma/migrations/20260806000200_phase1_identity/migration.sql",
  "packages/database/prisma/seed-runner.ts",
  "packages/database/tests/seed.test.ts",
  "scripts/verify-phase0.mjs",
  "scripts/verify-phase1.mjs",
  "PHASE1-VERIFICATION.md",
];
const failures = [];
for (const file of required) if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);


const identityPackage = JSON.parse(readFileSync(join(root, "modules/identity/package.json"), "utf8"));
const identityManifest = JSON.parse(readFileSync(join(root, "modules/identity/module.json"), "utf8"));
for (const field of ["name", "version"]) {
  if (identityPackage[field] !== identityManifest[field]) {
    failures.push(`Identity module ${field} differs between package.json and module.json`);
  }
}
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!String(rootPackage.scripts?.["verify:phase1"] ?? "").includes("verify:phase0")) {
  failures.push("verify:phase1 must preserve and run the Phase 0 verifier");
}

const schema = readFileSync(join(root, "packages/database/prisma/schema.prisma"), "utf8");
for (const model of ["User", "Role", "Permission", "UserRole", "RolePermission", "Session", "AuditLog", "EmailVerificationToken", "PasswordResetToken"]) {
  if (!schema.includes(`model ${model} `)) failures.push(`Prisma model missing: ${model}`);
}
const migration = readFileSync(join(root, "packages/database/prisma/migrations/20260806000200_phase1_identity/migration.sql"), "utf8");
for (const table of ["users", "roles", "permissions", "user_roles", "role_permissions", "sessions", "audit_logs"]) {
  if (!migration.includes(`CREATE TABLE \"${table}\"`)) failures.push(`Phase 1 migration table missing: ${table}`);
}
const identitySource = readFileSync(join(root, "modules/identity/src/application/identity-service.ts"), "utf8");
for (const capability of ["register(", "login(", "refresh(", "logoutAll(", "verifyEmail(", "resetPassword(", "assignRoles("]) {
  if (!identitySource.includes(capability)) failures.push(`Identity service capability missing: ${capability}`);
}
const routeSource = readFileSync(join(root, "modules/identity/src/api/routes.ts"), "utf8");
for (const route of [
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
  "/api/v1/auth/logout-all",
  "/api/v1/auth/me",
  "/api/v1/auth/email/verify",
  "/api/v1/auth/password/reset",
  "/api/v1/admin/users",
  "/api/v1/admin/roles",
  "/api/v1/admin/sessions",
  "/api/v1/admin/audit-logs",
]) {
  if (!routeSource.includes(route)) failures.push(`Identity API route missing: ${route}`);
}
const seed = readFileSync(join(root, "packages/database/prisma/seed-runner.ts"), "utf8");
for (const seeded of ["SUPER_ADMIN", "ADMIN", "USER", "ADMIN_EMAIL"]) if (!seed.includes(seeded)) failures.push(`Seed requirement missing: ${seeded}`);

const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
for (const importer of ["apps/admin:", "modules/identity:"]) {
  if (!lockfile.includes(importer)) failures.push(`Lockfile importer missing (${importer}); run pnpm install before Complete delivery`);
}

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
  if (/\.(ts|tsx|js|mjs)$/.test(file)) {
    const source = readFileSync(file, "utf8");
    if (/\b(register|boot)\s*\([^)]*\)\s*\{\s*\}/.test(source)) failures.push(`Empty lifecycle method: ${rel}`);
    if (/echo\s+.*tests passed/i.test(source)) failures.push(`Placeholder test content: ${rel}`);
  }
}

if (failures.length) {
  console.error("Phase 1 verification failed\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Phase 1 structure verified successfully.");

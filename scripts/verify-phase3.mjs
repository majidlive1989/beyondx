import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "packages/module-system/src/index.ts",
  "packages/module-system/tests/plugin-runtime.test.ts",
  "modules/plugin-manager/package.json",
  "modules/plugin-manager/module.json",
  "modules/plugin-manager/src/module.ts",
  "modules/plugin-manager/src/api/routes.ts",
  "modules/plugin-manager/src/application/plugin-manager-service.ts",
  "plugins/catalog/package.json",
  "plugins/catalog/plugin.json",
  "plugins/catalog/src/index.ts",
  "plugins/catalog/tests/plugin.test.ts",
  "modules/catalog/src/module.ts",
  "modules/catalog/src/application/catalog-service.ts",
  "modules/catalog/src/api/routes.ts",
  "modules/schema/src/module.ts",
  "modules/schema/src/application/schema-service.ts",
  "apps/api/src/plugin-state-store.ts",
  "apps/api/src/runtime.ts",
  "apps/admin/app/plugins/page.tsx",
  "apps/admin/components/admin-shell.tsx",
  "apps/admin/app/catalog/page.tsx",
  "apps/admin/app/catalog/taxonomy/page.tsx",
  "apps/admin/app/builder/page.tsx",
  "apps/admin/app/data/[schemaKey]/page.tsx",
  "packages/database/prisma/migrations/20260807000300_phase3_catalog/migration.sql",
  "packages/database/prisma/migrations/20260807000400_phase3_schema_engine/migration.sql",
  "packages/database/prisma/migrations/20260807000500_phase3_platform_builder_v2/migration.sql",
  "packages/database/prisma/migrations/20260808000100_phase3_plugin_runtime_catalog/migration.sql",
  "scripts/verify-phase3.mjs",
  "PHASE3-VERIFICATION.md",
];
const failures = [];
for (const file of required) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!String(rootPackage.scripts?.["verify:phase3"] ?? "").includes("verify:phase2")) {
  failures.push("verify:phase3 must preserve and run the Phase 2 verifier");
}
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
if (!workspace.includes('"plugins/*"')) failures.push("pnpm workspace does not discover plugins/*");

const pluginRuntimeSource = readFileSync(join(root, "packages/module-system/src/index.ts"), "utf8");
for (const symbol of ["PluginRegistry", "PluginRuntime", "PluginStateStore", "resolveEnabledModules", "PLUGIN_DISABLE_BEFORE_UNINSTALL"]) {
  if (!pluginRuntimeSource.includes(symbol)) failures.push(`Plugin Runtime behavior missing: ${symbol}`);
}

const catalogPlugin = readFileSync(join(root, "plugins/catalog/src/index.ts"), "utf8");
for (const feature of ["@beyondx/plugin-catalog", "createCatalogPlugin", "adminNavigation", 'href: "/catalog"']) {
  if (!catalogPlugin.includes(feature)) failures.push(`Catalog plugin contribution missing: ${feature}`);
}
const catalogModule = readFileSync(join(root, "modules/catalog/src/module.ts"), "utf8");
if (!catalogModule.includes('name: "@beyondx/plugin-catalog"')) {
  failures.push("Catalog runtime owner must be @beyondx/plugin-catalog");
}

const runtime = readFileSync(join(root, "apps/api/src/runtime.ts"), "utf8");
for (const behavior of ["new PluginRegistry()", "new PluginRuntime(", "createCatalogPlugin(database)", "resolveEnabledModules", "new PluginManagerModule"]) {
  if (!runtime.includes(behavior)) failures.push(`API plugin runtime integration missing: ${behavior}`);
}
if (runtime.includes("new CatalogModule({ database })")) {
  failures.push("Catalog is still hard-coded into the API core runtime");
}

const adminShell = readFileSync(join(root, "apps/admin/components/admin-shell.tsx"), "utf8");
if (!adminShell.includes("listRuntimePlugins")) failures.push("Admin shell does not consume plugin navigation contributions");
if (adminShell.includes('{ href: "/catalog", label: "Products"')) failures.push("Catalog navigation is still hard-coded in Admin shell");
if (!adminShell.includes('{ href: "/plugins", label: "Plugins"')) failures.push("Admin navigation is missing Plugin Manager");

const pluginPage = readFileSync(join(root, "apps/admin/app/plugins/page.tsx"), "utf8");
for (const action of ["installPlugin", "enablePlugin", "disablePlugin", "uninstallPlugin", "Restart required"]) {
  if (!pluginPage.includes(action)) failures.push(`Plugin Manager UI action missing: ${action}`);
}

const seed = readFileSync(join(root, "packages/database/prisma/seed-runner.ts"), "utf8");
if (seed.includes('"@beyondx/module-catalog",\n] as const')) failures.push("Catalog is still seeded as a core module");
for (const seeded of ["@beyondx/module-plugin-manager", "plugins.read", "plugins.manage", "@beyondx/plugin-catalog", "catalogPluginInstallation"]) {
  if (!seed.includes(seeded)) failures.push(`Plugin-aware seed behavior missing: ${seeded}`);
}

const pluginMigration = readFileSync(
  join(root, "packages/database/prisma/migrations/20260808000100_phase3_plugin_runtime_catalog/migration.sql"),
  "utf8",
);
for (const migrationBehavior of ["@beyondx/module-catalog", "@beyondx/plugin-catalog", "module_installations", "permissions"]) {
  if (!pluginMigration.includes(migrationBehavior)) failures.push(`Catalog plugin migration behavior missing: ${migrationBehavior}`);
}

const schema = readFileSync(join(root, "packages/database/prisma/schema.prisma"), "utf8");
for (const model of ["Brand", "Category", "CatalogAttribute", "AttributeValue", "Product", "ProductVariant", "VariantAttributeValue", "ProductMedia"]) {
  if (!schema.includes(`model ${model} `)) failures.push(`Prisma model missing: ${model}`);
}
if (!/sku\s+String\s+@unique/.test(schema)) failures.push("Catalog SKU must be unique");

const catalogMigration = readFileSync(join(root, "packages/database/prisma/migrations/20260807000300_phase3_catalog/migration.sql"), "utf8");
for (const table of ["catalog_products", "catalog_product_variants", "catalog_brands", "catalog_categories", "catalog_attributes", "catalog_attribute_values"]) {
  if (!catalogMigration.includes(`CREATE TABLE "${table}"`)) failures.push(`Phase 3 Catalog migration table missing: ${table}`);
}

const schemaMigration = readFileSync(join(root, "packages/database/prisma/migrations/20260807000400_phase3_schema_engine/migration.sql"), "utf8");
for (const table of ["data_schemas", "data_fields", "data_records", "entity_extensions"]) {
  if (!schemaMigration.includes(`CREATE TABLE "${table}"`)) failures.push(`Schema Engine migration table missing: ${table}`);
}
const builderV2Migration = readFileSync(join(root, "packages/database/prisma/migrations/20260807000500_phase3_platform_builder_v2/migration.sql"), "utf8");
for (const enumValue of ["COMPONENT", "RICH_TEXT", "UID", "DYNAMIC_ZONE"]) {
  if (!builderV2Migration.includes(`'${enumValue}'`)) failures.push(`Platform Builder v2 enum value missing: ${enumValue}`);
}

const schemaServiceSource = readFileSync(join(root, "modules/schema/src/application/schema-service.ts"), "utf8");
for (const behavior of ["SCHEMA_COMPONENT_CYCLE", "SCHEMA_UID_NOT_UNIQUE", "SCHEMA_DYNAMIC_ZONE_COMPONENT_INVALID", "componentSchemaId", "dynamicZoneSchemaIds"]) {
  if (!schemaServiceSource.includes(behavior)) failures.push(`Platform Builder behavior missing: ${behavior}`);
}
const builderSource = readFileSync(join(root, "apps/admin/app/builder/page.tsx"), "utf8");
for (const feature of ["Reusable component", "DYNAMIC_ZONE", "Generate from", "Allowed components"]) {
  if (!builderSource.includes(feature)) failures.push(`Builder UI feature missing: ${feature}`);
}
const generatedDataSource = readFileSync(join(root, "apps/admin/app/data/[schemaKey]/page.tsx"), "utf8");
if (!generatedDataSource.includes("ComponentInputs") || !generatedDataSource.includes("Add block")) {
  failures.push("Generated Admin forms do not render reusable components and dynamic zones");
}

const routeSource = readFileSync(join(root, "modules/catalog/src/api/routes.ts"), "utf8");
for (const route of [
  "/api/v1/catalog/products",
  "/api/v1/admin/catalog/products",
  "/api/v1/admin/catalog/brands",
  "/api/v1/admin/catalog/categories",
  "/api/v1/admin/catalog/attributes",
  "/api/v1/admin/catalog/products/:id/variants",
]) {
  if (!routeSource.includes(route)) failures.push(`Catalog API route missing: ${route}`);
}
const catalogService = readFileSync(join(root, "modules/catalog/src/application/catalog-service.ts"), "utf8");
for (const behavior of ["normalizeSku", "CATALOG_DUPLICATE_VARIANT_ATTRIBUTE", "CATALOG_ACTIVE_PRODUCT_REQUIRES_VARIANT", "CATALOG_MEDIA_INVALID", "CATALOG_CATEGORY_CYCLE", "validateExtensionValues"]) {
  if (!catalogService.includes(behavior)) failures.push(`Catalog service rule missing: ${behavior}`);
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
  console.error("Phase 3 verification failed\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Phase 3 Plugin Runtime + Platform Builder + Catalog Plugin structure verified successfully.");

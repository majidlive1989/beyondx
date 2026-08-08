import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "modules/catalog/package.json",
  "modules/catalog/module.json",
  "modules/catalog/src/module.ts",
  "modules/catalog/src/domain/models.ts",
  "modules/catalog/src/domain/permissions.ts",
  "modules/catalog/src/application/catalog-service.ts",
  "modules/catalog/src/infrastructure/prisma-catalog-repository.ts",
  "modules/catalog/src/api/routes.ts",
  "modules/catalog/tests/catalog-service.test.ts",
  "modules/catalog/tests/module.test.ts",
  "modules/schema/package.json",
  "modules/schema/module.json",
  "modules/schema/src/module.ts",
  "modules/schema/src/application/schema-service.ts",
  "modules/schema/src/infrastructure/prisma-schema-repository.ts",
  "modules/schema/src/api/routes.ts",
  "modules/schema/tests/schema-service.test.ts",
  "modules/schema/tests/module.test.ts",
  "apps/admin/app/catalog/page.tsx",
  "apps/admin/app/catalog/taxonomy/page.tsx",
  "apps/admin/app/builder/page.tsx",
  "apps/admin/app/data/[schemaKey]/page.tsx",
  "packages/database/prisma/migrations/20260807000300_phase3_catalog/migration.sql",
  "packages/database/prisma/migrations/20260807000400_phase3_schema_engine/migration.sql",
  "packages/database/prisma/migrations/20260807000500_phase3_platform_builder_v2/migration.sql",
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

const catalogPackage = JSON.parse(readFileSync(join(root, "modules/catalog/package.json"), "utf8"));
const catalogManifest = JSON.parse(readFileSync(join(root, "modules/catalog/module.json"), "utf8"));
for (const field of ["name", "version"]) {
  if (catalogPackage[field] !== catalogManifest[field]) failures.push(`Catalog module ${field} differs between package.json and module.json`);
}

const schema = readFileSync(join(root, "packages/database/prisma/schema.prisma"), "utf8");
for (const model of ["Brand", "Category", "CatalogAttribute", "AttributeValue", "Product", "ProductVariant", "VariantAttributeValue", "ProductMedia"]) {
  if (!schema.includes(`model ${model} `)) failures.push(`Prisma model missing: ${model}`);
}
for (const field of ["sku", "brandId", "categoryId", "attributeValueId", "mediaAssetId"]) {
  if (!schema.includes(field)) failures.push(`Catalog schema field missing: ${field}`);
}
if (!/sku\s+String\s+@unique/.test(schema)) failures.push("Catalog SKU must be unique");

const migration = readFileSync(join(root, "packages/database/prisma/migrations/20260807000300_phase3_catalog/migration.sql"), "utf8");
for (const table of ["catalog_products", "catalog_product_variants", "catalog_brands", "catalog_categories", "catalog_attributes", "catalog_attribute_values"]) {
  if (!migration.includes(`CREATE TABLE \"${table}\"`)) failures.push(`Phase 3 migration table missing: ${table}`);
}
if (!migration.includes('catalog_product_variants_sku_key')) failures.push("Unique SKU migration index is missing");

const schemaMigration = readFileSync(join(root, "packages/database/prisma/migrations/20260807000400_phase3_schema_engine/migration.sql"), "utf8");
for (const table of ["data_schemas", "data_fields", "data_records", "entity_extensions"]) {
  if (!schemaMigration.includes(`CREATE TABLE \"${table}\"`)) failures.push(`Schema Engine migration table missing: ${table}`);
}
for (const model of ["DataSchema", "DataField", "DataRecord", "EntityExtension"]) {
  if (!schema.includes(`model ${model} `)) failures.push(`Schema Engine Prisma model missing: ${model}`);
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

const schemaRoutes = readFileSync(join(root, "modules/schema/src/api/routes.ts"), "utf8");
for (const route of [
  "/api/v1/admin/schemas",
  "/api/v1/admin/data/:schemaKey",
  "/api/v1/admin/extensions/:schemaKey/:targetType/:targetId",
  "/api/v1/data/:schemaKey",
]) {
  if (!schemaRoutes.includes(route)) failures.push(`Schema Engine API route missing: ${route}`);
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

const serviceSource = readFileSync(join(root, "modules/catalog/src/application/catalog-service.ts"), "utf8");
for (const behavior of ["normalizeSku", "CATALOG_DUPLICATE_VARIANT_ATTRIBUTE", "CATALOG_ACTIVE_PRODUCT_REQUIRES_VARIANT", "CATALOG_MEDIA_INVALID", "CATALOG_CATEGORY_CYCLE"]) {
  if (!serviceSource.includes(behavior)) failures.push(`Catalog service rule missing: ${behavior}`);
}

const seed = readFileSync(join(root, "packages/database/prisma/seed-runner.ts"), "utf8");
for (const seeded of ["@beyondx/module-catalog", "@beyondx/module-schema", "schema.builder.manage", "schema.records.read", "catalog.product", "catalog.variant", "catalog.products.read", "catalog.variants.manage", "catalog.categories.manage", "catalog.brands.manage", "catalog.attributes.manage"]) {
  if (!seed.includes(seeded)) failures.push(`Phase 3 seed requirement missing: ${seeded}`);
}

const runtime = readFileSync(join(root, "apps/api/src/runtime.ts"), "utf8");
if (!runtime.includes("new SchemaModule({ database })")) failures.push("API runtime does not register SchemaModule");
if (!runtime.includes("new CatalogModule({ database })")) failures.push("API runtime does not register CatalogModule");
const adminShell = readFileSync(join(root, "apps/admin/components/admin-shell.tsx"), "utf8");
if (!adminShell.includes('href: "/catalog"')) failures.push("Admin navigation is missing Catalog");
if (!adminShell.includes('href: "/builder"')) failures.push("Admin navigation is missing Builder");
const catalogService = readFileSync(join(root, "modules/catalog/src/application/catalog-service.ts"), "utf8");
if (!catalogService.includes("validateExtensionValues")) failures.push("Catalog does not validate schema-driven custom fields");
if (!catalogService.includes('"catalog.product"') || !catalogService.includes('"catalog.variant"')) failures.push("Catalog system-extension schemas are not integrated");

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
  if (rel === ".env" || /(^|\/)(node_modules|dist|\.next|coverage|\.turbo)(\/|$)/.test(rel)) failures.push(`Forbidden output included: ${rel}`);
}

if (failures.length) {
  console.error("Phase 3 verification failed\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Phase 3 Platform Builder + Catalog structure verified successfully.");

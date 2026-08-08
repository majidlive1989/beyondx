import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "packages/core/src/kernel.ts",
  "packages/module-system/src/index.ts",
  "packages/module-system/tests/plugin-runtime.test.ts",
  "modules/plugin-manager/src/application/plugin-manager-service.ts",
  "modules/commerce/package.json",
  "modules/commerce/module.json",
  "modules/commerce/src/module.ts",
  "modules/commerce/src/application/commerce-service.ts",
  "modules/commerce/src/api/routes.ts",
  "modules/commerce/src/domain/permissions.ts",
  "modules/commerce/tests/contracts.test.ts",
  "plugins/commerce/package.json",
  "plugins/commerce/plugin.json",
  "plugins/commerce/src/index.ts",
  "plugins/commerce/tests/plugin.test.ts",
  "apps/api/src/runtime.ts",
  "apps/api/src/module-routes.ts",
  "apps/api/src/app.ts",
  "apps/admin/app/plugins/page.tsx",
  "apps/admin/components/admin-shell.tsx",
  "apps/admin/app/commerce/page.tsx",
  "packages/database/prisma/migrations/20260808000200_phase4_commerce_engine/migration.sql",
  "scripts/verify-phase4.mjs",
  "PHASE4-VERIFICATION.md",
  "PHASE4-COMMERCE-PLUGIN-README.md",
];

const failures = [];
for (const file of required) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!String(rootPackage.scripts?.["verify:phase4"] ?? "").includes("verify:phase3")) {
  failures.push("verify:phase4 must preserve and run the Phase 3 verifier");
}

const kernel = readFileSync(join(root, "packages/core/src/kernel.ts"), "utf8");
for (const behavior of ["async activate(name", "async deactivate(name", "MODULE_DEPENDENCY_INACTIVE", "MODULE_LIFECYCLE_BUSY"]) {
  if (!kernel.includes(behavior)) failures.push(`Hot module lifecycle behavior missing: ${behavior}`);
}

const pluginRuntime = readFileSync(join(root, "packages/module-system/src/index.ts"), "utf8");
for (const behavior of [
  "PluginLifecycleController",
  "attachLifecycle",
  "resolveAvailableModules",
  "lifecycle.activate",
  "lifecycle.deactivate",
  "restartRequired: false",
  "PLUGIN_REQUIRED_BY_ENABLED_PLUGIN",
]) {
  if (!pluginRuntime.includes(behavior)) failures.push(`Hot plugin runtime behavior missing: ${behavior}`);
}

const runtime = readFileSync(join(root, "apps/api/src/runtime.ts"), "utf8");
for (const behavior of [
  "createCatalogPlugin(database)",
  "createCommercePlugin(database)",
  "resolveAvailableModules",
  "attachLifecycle",
  "kernel.activate(packageName)",
  "kernel.deactivate(packageName)",
]) {
  if (!runtime.includes(behavior)) failures.push(`API hot plugin integration missing: ${behavior}`);
}

const moduleRoutes = readFileSync(join(root, "apps/api/src/module-routes.ts"), "utf8");
for (const behavior of ["isPluginActive", "PLUGIN_ROUTE_INACTIVE", 'route.owner.startsWith("@beyondx/plugin-")']) {
  if (!moduleRoutes.includes(behavior)) failures.push(`Dynamic route gating missing: ${behavior}`);
}

const pluginPage = readFileSync(join(root, "apps/admin/app/plugins/page.tsx"), "utf8");
for (const behavior of ["refreshSession", "beyondx:plugins-changed", "without restarting the service"]) {
  if (!pluginPage.includes(behavior)) failures.push(`Hot Plugin Manager UI behavior missing: ${behavior}`);
}
if (pluginPage.includes("Restart required") || pluginPage.includes("after restart")) {
  failures.push("Plugin Manager UI still requires an API restart");
}
const adminShell = readFileSync(join(root, "apps/admin/components/admin-shell.tsx"), "utf8");
if (!adminShell.includes('addEventListener("beyondx:plugins-changed"')) {
  failures.push("Admin shell does not refresh plugin navigation after hot lifecycle changes");
}

const commercePlugin = readFileSync(join(root, "plugins/commerce/src/index.ts"), "utf8");
for (const feature of [
  'id: "commerce"',
  'packageName: "@beyondx/plugin-commerce"',
  'pluginDependencies: ["catalog"]',
  'href: "/commerce"',
]) {
  if (!commercePlugin.includes(feature)) failures.push(`Commerce plugin contribution missing: ${feature}`);
}

const schema = readFileSync(join(root, "packages/database/prisma/schema.prisma"), "utf8");
for (const model of [
  "CommercePrice",
  "CommerceWarehouse",
  "CommerceStockLevel",
  "CommerceStockMovement",
  "CommerceCart",
  "CommerceCartItem",
  "CommerceCheckoutSession",
  "CommerceOrder",
  "CommerceOrderItem",
]) {
  if (!schema.includes(`model ${model} `)) failures.push(`Prisma Commerce model missing: ${model}`);
}
for (const enumName of ["CommerceCartStatus", "CommerceCheckoutStatus", "CommerceOrderStatus", "CommerceStockMovementType"]) {
  if (!schema.includes(`enum ${enumName} `)) failures.push(`Prisma Commerce enum missing: ${enumName}`);
}

const migration = readFileSync(
  join(root, "packages/database/prisma/migrations/20260808000200_phase4_commerce_engine/migration.sql"),
  "utf8",
);
for (const table of [
  "commerce_prices",
  "commerce_warehouses",
  "commerce_stock_levels",
  "commerce_stock_movements",
  "commerce_carts",
  "commerce_cart_items",
  "commerce_checkout_sessions",
  "commerce_orders",
  "commerce_order_items",
]) {
  if (!migration.includes(`CREATE TABLE "${table}"`)) failures.push(`Phase 4 migration table missing: ${table}`);
}

const service = readFileSync(join(root, "modules/commerce/src/application/commerce-service.ts"), "utf8");
for (const behavior of [
  "assertMoney",
  "Number.isSafeInteger",
  "COMMERCE_INSUFFICIENT_STOCK",
  "commerceStockMovement",
  "idempotencyKey",
  "TransactionIsolationLevel.Serializable",
  "timingSafeEqual",
  'type: "RESERVE"',
  'type: "SALE"',
  'type: "RELEASE"',
]) {
  if (!service.includes(behavior)) failures.push(`Commerce domain behavior missing: ${behavior}`);
}

const commerceModule = readFileSync(join(root, "modules/commerce/src/module.ts"), "utf8");
for (const behavior of ["commerce.order", "commerce.cart", "ensureSystemExtensionSchema", "@beyondx/plugin-commerce"]) {
  if (!commerceModule.includes(behavior)) failures.push(`Commerce schema-extension behavior missing: ${behavior}`);
}

const routes = readFileSync(join(root, "modules/commerce/src/api/routes.ts"), "utf8");
for (const route of [
  "/api/v1/admin/commerce/prices",
  "/api/v1/admin/commerce/warehouses",
  "/api/v1/admin/commerce/stock",
  "/api/v1/commerce/carts",
  "/api/v1/commerce/checkout",
  "/api/v1/admin/commerce/orders",
]) {
  if (!routes.includes(route)) failures.push(`Commerce API route missing: ${route}`);
}

const adminCommerce = readFileSync(join(root, "apps/admin/app/commerce/page.tsx"), "utf8");
for (const feature of ["Variant price", "Warehouses", "Adjust stock", "Checkout orders", "confirmCommerceOrder", "cancelCommerceOrder"]) {
  if (!adminCommerce.includes(feature)) failures.push(`Commerce Admin UI feature missing: ${feature}`);
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
  console.error("Phase 4 verification failed\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Phase 4 Commerce Plugin + Hot Plugin Lifecycle structure verified successfully.");

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`Missing ${path}`);
}

function requireText(path, values) {
  requireFile(path);
  if (!existsSync(resolve(root, path))) return;
  const text = readFileSync(resolve(root, path), "utf8");
  for (const value of values) {
    if (!text.includes(value)) failures.push(`${path} does not contain ${value}`);
  }
}

requireText("packages/theme-sdk/package.json", ["@beyondx/theme-sdk"]);
requireText("packages/theme-sdk/src/client.ts", ["BeyondXThemeClient", "/api/v1/theme/manifest", "/api/v1/catalog/products", "/api/v1/content/"]);
requireText("modules/theme/module.json", ["@beyondx/module-theme", "theme.delivery", "theme.sdk"]);
requireText("modules/theme/src/api/routes.ts", ["/api/v1/theme/manifest", "@beyondx/plugin-catalog", "@beyondx/plugin-discussion"]);
requireText("apps/api/src/runtime.ts", ["ThemeModule", "@beyondx/module-theme"]);
requireText("apps/api/package.json", ["@beyondx/module-theme"]);
requireText("package.json", ["verify:phase5"]);

if (failures.length > 0) {
  console.error("Phase 5 Theme SDK verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Phase 5A Theme Delivery Bridge + SDK structure verified successfully.");

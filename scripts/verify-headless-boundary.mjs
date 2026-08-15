import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

if (existsSync(resolve(root, "apps/storefront"))) {
  failures.push("apps/storefront must not exist in BeyondX Core. Run scripts/apply-phase5c6-cleanup.ps1 if upgrading from Phase 5C.5.");
}

for (const path of [".env.example", "turbo.json"]) {
  if (read(path).includes("NEXT_PUBLIC_STOREFRONT_URL")) {
    failures.push(`${path} still contains NEXT_PUBLIC_STOREFRONT_URL`);
  }
}

for (const path of [
  "docs/FRONTEND-INTEGRATION-CONTRACT.md",
  "packages/theme-sdk/src/client.ts",
  "modules/theme/src/api/routes.ts",
]) {
  if (!existsSync(resolve(root, path))) failures.push(`Missing ${path}`);
}

const contract = read("docs/FRONTEND-INTEGRATION-CONTRACT.md");
for (const endpoint of [
  "/api/v1/site/settings",
  "/api/v1/navigation",
  "/api/v1/pages/:slug",
  "/api/v1/blog/posts/:slug",
  "/api/v1/media/:id/content",
  "/api/v1/forms/contact",
  "/api/v1/seo/config",
  "/api/v1/seo/sitemap",
]) {
  if (!contract.includes(endpoint)) failures.push(`Frontend contract is missing ${endpoint}`);
}

if (failures.length > 0) {
  console.error("BeyondX headless boundary verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("BeyondX headless boundary verified: Core is frontend-independent.");

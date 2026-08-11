import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "apps/admin/app/content/page.tsx",
  "apps/admin/app/content/[contentTypeId]/page.tsx",
  "apps/admin/app/content/content.module.css",
  "apps/admin/app/comments/page.tsx",
  "apps/admin/components/admin-shell.tsx",
  "modules/content/src/domain/permissions.ts",
  "modules/content/src/application/content-service.ts",
  "modules/schema/src/application/schema-service.ts",
  "modules/discussion/package.json",
  "modules/discussion/module.json",
  "modules/discussion/src/module.ts",
  "modules/discussion/src/application/discussion-service.ts",
  "modules/discussion/src/api/routes.ts",
  "modules/discussion/src/domain/permissions.ts",
  "plugins/discussion/package.json",
  "plugins/discussion/plugin.json",
  "plugins/discussion/src/index.ts",
  "packages/database/prisma/migrations/20260808000300_phase4_discussion_engine/migration.sql",
  "scripts/verify-phase4.mjs",
  "PHASE4-CMS-EXPERIENCE-README.md",
  "PHASE4-VERIFICATION.md",
];

const failures = [];
for (const file of required) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!String(rootPackage.scripts?.["verify:phase4"] ?? "").includes("verify:phase3")) {
  failures.push("verify:phase4 must preserve and run the Phase 3 verifier");
}

const shell = readFileSync(join(root, "apps/admin/components/admin-shell.tsx"), "utf8");
for (const behavior of ["listContentTypes", "publishableContent", 'label: "Content"', "listRuntimeDataSchemas", "contentPluginItems", "displayNavLabel"]) {
  if (!shell.includes(behavior)) failures.push(`CMS navigation behavior missing: ${behavior}`);
}
if (shell.includes('label: "CMS content"')) failures.push("Legacy generic CMS content navigation is still visible");
if (shell.includes('label: "CMS models"')) failures.push("Technical CMS models are still exposed in everyday Settings navigation");

const home = readFileSync(join(root, "apps/admin/app/content/page.tsx"), "utf8");
for (const behavior of ["Publishable content", "Collections", "Structure builder", "listContentTypes", "listRuntimeDataSchemas"]) {
  if (!home.includes(behavior)) failures.push(`Content home behavior missing: ${behavior}`);
}

const editor = readFileSync(join(root, "apps/admin/app/content/[contentTypeId]/page.tsx"), "utf8");
for (const behavior of [
  "Save draft",
  "Publish",
  "Unpublish",
  "Archive",
  "Schedule",
  "Recent revisions",
  "slugify",
  "SEO",
  "listContentRevisions",
  "scheduleContentEntry",
  "relationOptions",
  "Discussion",
  "getDiscussionSettings",
  "updateDiscussionSettings",
]) {
  if (!editor.includes(behavior)) failures.push(`Publishable content editor behavior missing: ${behavior}`);
}

const discussionPlugin = readFileSync(join(root, "plugins/discussion/src/index.ts"), "utf8");
for (const behavior of ["@beyondx/plugin-discussion", "Comments & Reviews", "discussion.product-reviews", 'href: "/comments"']) {
  if (!discussionPlugin.includes(behavior)) failures.push(`Discussion plugin contribution missing: ${behavior}`);
}

const discussionModule = readFileSync(join(root, "modules/discussion/src/module.ts"), "utf8");
for (const behavior of ["DiscussionService", "DISCUSSION_PERMISSIONS", "createDiscussionRoutes", 'name: "@beyondx/plugin-discussion"']) {
  if (!discussionModule.includes(behavior)) failures.push(`Discussion module behavior missing: ${behavior}`);
}

const discussionService = readFileSync(join(root, "modules/discussion/src/application/discussion-service.ts"), "utf8");
for (const behavior of [
  "PENDING",
  "APPROVED",
  "SPAM",
  "TRASH",
  "verifiedPurchaseOnly",
  "ratingEnabled",
  "requirePublicSource",
  "discussion.moderate",
  "discussion.reply",
  "requireCatalogEnabled",
  "DISCUSSION_REPLY_NESTING_INVALID",
]) {
  if (!discussionService.includes(behavior)) failures.push(`Discussion service rule missing: ${behavior}`);
}

const discussionRoutes = readFileSync(join(root, "modules/discussion/src/api/routes.ts"), "utf8");
for (const route of [
  "/api/v1/discussions/:sourceType/:sourceId",
  "/api/v1/discussions",
  "/api/v1/admin/discussions",
  "/api/v1/admin/discussions/:id/status",
  "/api/v1/admin/discussions/:id/replies",
  "/api/v1/admin/discussions/settings/:sourceType/:sourceId",
]) {
  if (!discussionRoutes.includes(route)) failures.push(`Discussion API route missing: ${route}`);
}

const discussionPage = readFileSync(join(root, "apps/admin/app/comments/page.tsx"), "utf8");
for (const behavior of ["Comments & reviews", "Pending", "Approved", "Spam", "Trash", "Product review", "Post reply"]) {
  if (!discussionPage.includes(behavior)) failures.push(`Discussion Admin UX missing: ${behavior}`);
}

const runtime = readFileSync(join(root, "apps/api/src/runtime.ts"), "utf8");
if (!runtime.includes("createDiscussionPlugin(database)")) failures.push("Discussion plugin is not registered in API Plugin Runtime");

const schema = readFileSync(join(root, "packages/database/prisma/schema.prisma"), "utf8");
for (const model of ["DiscussionEntry", "DiscussionSettings"]) {
  if (!schema.includes(`model ${model} `)) failures.push(`Prisma discussion model missing: ${model}`);
}
for (const enumName of ["DiscussionSourceType", "DiscussionKind", "DiscussionStatus"]) {
  if (!schema.includes(`enum ${enumName} `)) failures.push(`Prisma discussion enum missing: ${enumName}`);
}

const migration = readFileSync(join(root, "packages/database/prisma/migrations/20260808000300_phase4_discussion_engine/migration.sql"), "utf8");
for (const table of ["discussion_entries", "discussion_settings"]) {
  if (!migration.includes(`CREATE TABLE "${table}"`)) failures.push(`Discussion migration table missing: ${table}`);
}

const contentPermissions = readFileSync(join(root, "modules/content/src/domain/permissions.ts"), "utf8");
for (const permission of ["content.entries.read", "content.entries.create", "content.entries.update", "content.entries.publish", "content.revisions.read"]) {
  if (!contentPermissions.includes(permission)) failures.push(`CMS permission missing: ${permission}`);
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
console.log("Phase 4 CMS Experience + Discussion Plugin structure verified successfully.");

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

requireText("packages/theme-sdk/src/client.ts", ["BeyondXThemeClient", "/api/v1/media/", "metadataUrl"]);
requireText("packages/theme-sdk/src/types.ts", ["PublicMediaAsset", 'visibility: "PUBLIC"']);
requireText("modules/theme/src/api/routes.ts", ["/api/v1/theme/manifest", "/api/v1/media/:id", "/api/v1/media/:id/content", "publicMedia: true"]);
requireText("modules/media/src/domain/public-delivery.ts", ["MediaVisibility", "publicMediaEtag", "publicFlagFromVisibility"]);
requireText("modules/media/src/api/routes.ts", [
  "/api/v1/media/:id",
  "/api/v1/media/:id/content",
  "/api/v1/admin/media/:id/visibility",
  "must-revalidate",
  "if-none-match",
  "MEDIA_VISIBILITY_INVALID",
]);
requireText("modules/media/src/application/media-service.ts", ["publicGet", "publicContent", "setVisibility", "MEDIA_PUBLIC_ASSET_NOT_FOUND", "!asset.isPublic"]);
requireText("packages/database/prisma/schema.prisma", ["isPublic", "@default(false)"]);
requireText("packages/database/prisma/migrations/20260811000100_phase5b_public_media_delivery/migration.sql", ["isPublic", "DEFAULT false"]);
requireText("apps/admin/lib/api.ts", ["setMediaVisibility", "visibility"]);
requireText("apps/admin/app/media/page.tsx", ["Phase 5B · Public Media Delivery", "Make {selected.visibility"]);
requireText("modules/catalog/src/api/routes.ts", ["publicStorefrontProduct", "item.isPublic"]);

// Phase 5C.1 corporate site globals reuse the Schema Engine instead of introducing a second settings store.
requireText("packages/database/prisma/seed-runner.ts", ["seedSiteGlobals", 'key: "site-settings"', 'kind: "SINGLE"', "site-social-link", "companyName", "favicon", "socialLinks", "copyrightText", "seoImage"]);
requireText("packages/database/tests/seed.test.ts", ["site-settings", "site-social-link", "state.fields.size"]);
requireText("modules/schema/src/api/routes.ts", ['"/api/v1/site/settings"', '"site-settings"', "siteSettingsEnvelopeJsonSchema"]);
requireText("modules/schema/src/api/routes.ts", ['"/api/v1/pages"', '"/api/v1/pages/:slug"', '"/api/v1/blog/posts"', '"/api/v1/blog/posts/:slug"', '"/api/v1/blog/categories"', '"/api/v1/blog/tags"']);
requireText("modules/schema/src/application/schema-service.ts", ["getRecordByStringValue", "SCHEMA_LOOKUP_FIELD_INVALID"]);
requireText("modules/schema/src/infrastructure/prisma-schema-repository.ts", ["findRecordByStringValue", '"values" ->>']);
requireText("packages/database/prisma/seed-runner.ts", ['key: "site-page"', 'key: "blog-post"', 'key: "blog-category"', 'key: "blog-tag"', "seedCorporateContent"]);
requireText("apps/admin/components/admin-shell.tsx", ["corporateContent", '"Pages"', 'href: "/blog"', 'label: "Blog"']);
requireText("packages/theme-sdk/src/client.ts", ["readonly pages", "readonly blog", '"/api/v1/pages"', '"/api/v1/blog/posts"']);
requireText("packages/theme-sdk/src/types.ts", ["CorporatePageValues", "BlogPostValues", "BlogCategoryValues", "BlogTagValues", "corporateContent"]);
requireText("apps/admin/app/site-settings/page.tsx", ["Site settings", "+ Add social network", "SOCIAL_PLATFORMS", "updateDynamicRecord", "createDynamicRecord"]);
requireText("apps/admin/components/admin-shell.tsx", ['href: "/site-settings"', 'reservedCorporateKeys']);
requireText("packages/database/prisma/seed-runner.ts", ['key: "platform"', 'type: "ENUM"', '"INSTAGRAM"', '"WHATSAPP"', '"CUSTOM"']);
requireText("packages/theme-sdk/src/types.ts", ["SiteSocialPlatform", "platform?: SiteSocialPlatform"]);

requireText("modules/theme/src/api/routes.ts", ["siteGlobals: true", 'siteSettings: "/api/v1/site/settings"']);
requireText("packages/theme-sdk/src/types.ts", ["SiteSettingsValues", "SiteSocialLink", "companyName", "favicon", "copyrightText", "siteGlobals"]);
requireText("packages/theme-sdk/src/client.ts", ["readonly site", "getSettings", '"/api/v1/site/settings"']);
requireText("packages/theme-sdk/tests/client.test.ts", ["reads the conventional public site settings single type", "/api/v1/site/settings"]);
requireText("PHASE5C1-CORPORATE-SITE-GLOBALS-README.md", ["Corporate Site Globals", "site-settings", "pnpm db:seed", "@beyondx/theme-sdk"]);

requireText("apps/admin/app/blog/page.tsx", ["Editorial workspace", "/blog/new", "Blog"]);
requireText("apps/admin/components/blog-post-editor.tsx", ["Blog editor", "createCategory", "createTag", "Save draft", "Publish", "SEO"]);
requireText("apps/admin/app/blog/new/page.tsx", ["BlogPostEditor"]);
requireText("apps/admin/app/blog/post/[id]/page.tsx", ["BlogPostEditor", "useParams"]);
requireText("apps/admin/components/admin-shell.tsx", ['href: "/blog"', 'label: "Blog"', '"blog-category"', '"blog-tag"']);
requireText("apps/admin/lib/api.ts", ["getDynamicRecord", "/api/v1/admin/data/"]);
requireText("apps/admin/app/globals.css", ["Phase 5C.2B Editorial Admin UX", "blog-editor-layout", "editor-tag-chip"]);

requireText("packages/database/prisma/seed-runner.ts", ["seedSiteNavigation", 'key: "site-navigation-item"', 'key: "site-navigation"', "headerItems", "footerItems"]);
requireText("packages/database/tests/seed.test.ts", ["site-navigation-item", "site-navigation", "state.fields.size"]);
requireText("modules/schema/src/api/routes.ts", ['"/api/v1/navigation"', "resolveNavigation", "navigationEnvelopeJsonSchema"]);
requireText("modules/schema/tests/navigation-route.test.ts", ["Public navigation delivery", '"page-home"', '"https://example.com"']);
requireText("apps/admin/app/navigation/page.tsx", ["Header menu", "Footer menu", "Save navigation", "Move"]);
requireText("apps/admin/components/admin-shell.tsx", ['href: "/navigation"', 'label: "Navigation"', '"site-navigation"']);
requireText("packages/theme-sdk/src/client.ts", ["readonly navigation", '"/api/v1/navigation"']);
requireText("packages/theme-sdk/src/types.ts", ["NavigationPayload", "NavigationItem", "navigation"]);
requireText("modules/theme/src/api/routes.ts", ["navigation: true", 'navigation: "/api/v1/navigation"']);


requireText("packages/database/prisma/seed-runner.ts", ["seedContactForms", 'key: "contact-submission"', 'publicRead: false', 'label: "Message"']);
requireText("packages/database/tests/seed.test.ts", ["contact-submission", "state.fields.size"]);
requireText("modules/schema/src/api/routes.ts", ['"/api/v1/forms/contact"', "contactFormSubmissionSchema", "publicFormRoute", "publicActionMetadata", "website"]);
requireText("modules/schema/tests/contact-form-route.test.ts", ["Public contact form delivery", '"contact-submission"', "honeypot"]);
requireText("apps/admin/app/contact-submissions/page.tsx", ["Contact inbox", "Mark unread", "Reply by email", '"contact-submission"']);
requireText("apps/admin/components/admin-shell.tsx", ['label: "Messages"', 'href: "/contact-submissions"', '"contact-submission"']);
requireText("packages/theme-sdk/src/client.ts", ["readonly forms", '"/api/v1/forms/contact"', 'form !== "contact"']);
requireText("packages/theme-sdk/src/types.ts", ["ContactFormSubmissionInput", "FormSubmissionResult", "PublicFormName", "forms"]);
requireText("packages/theme-sdk/tests/client.test.ts", ["submits the contact form through the stable forms API", "/api/v1/forms/contact"]);
requireText("modules/theme/src/api/routes.ts", ["forms: true", 'contactForm: "/api/v1/forms/contact"']);

requireText("packages/database/prisma/seed-runner.ts", ['key: "siteUrl"', 'key: "allowSearchIndexing"', 'label: "Allow search indexing"']);
requireText("apps/admin/app/site-settings/page.tsx", ["Website URL", "Allow search engines to index this website", "allowSearchIndexing"]);
requireText("modules/schema/src/api/routes.ts", ['"/api/v1/seo/config"', '"/api/v1/seo/sitemap"', "buildSeoConfig", "buildSitemapEntries", "publicSeoRoute"]);
requireText("modules/schema/tests/seo-route.test.ts", ["Public SEO delivery", "noIndex", '"BLOG_POST"']);
requireText("packages/theme-sdk/src/client.ts", ["readonly seo", '"/api/v1/seo/config"', '"/api/v1/seo/sitemap"']);
requireText("packages/theme-sdk/src/types.ts", ["SeoConfig", "SeoSitemapEntry", "SeoSitemapPayload", "allowSearchIndexing", "seo: boolean"]);
requireText("packages/theme-sdk/tests/client.test.ts", ["reads SEO defaults and sitemap entries", "/api/v1/seo/sitemap"]);
requireText("modules/theme/src/api/routes.ts", ["seo: true", 'seoConfig: "/api/v1/seo/config"', 'seoSitemap: "/api/v1/seo/sitemap"']);

requireText("package.json", ["verify:phase5"]);

if (failures.length > 0) {
  console.error("Phase 5C.5 verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Phase 5C.5 SEO + Public Delivery structure verified successfully.");

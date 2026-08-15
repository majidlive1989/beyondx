import { describe, expect, it } from "vitest";
import { buildThemeDeliveryManifest } from "../src/api/routes.js";
import { THEME_MANIFEST } from "../src/module.js";

describe("Theme delivery bridge", () => {
  it("is a core delivery capability with optional plugin integrations", () => {
    expect(THEME_MANIFEST).toMatchObject({
      name: "@beyondx/module-theme",
      dependencies: ["@beyondx/module-foundation", "@beyondx/module-content", "@beyondx/module-media", "@beyondx/module-schema"],
      permissions: [],
    });
  });

  it("discovers only active optional delivery capabilities", () => {
    const active = new Set(["@beyondx/plugin-catalog", "@beyondx/plugin-discussion"]);
    const manifest = buildThemeDeliveryManifest({ isPluginActive: (packageName) => active.has(packageName) });
    expect(manifest.capabilities).toMatchObject({ siteGlobals: true, corporateContent: true, navigation: true, forms: true, seo: true, publicMedia: true, catalog: true, discussions: true, commerce: false });
    expect(manifest.endpoints.siteSettings).toBe("/api/v1/site/settings");
    expect(manifest.endpoints.navigation).toBe("/api/v1/navigation");
    expect(manifest.endpoints.contactForm).toBe("/api/v1/forms/contact");
    expect(manifest.endpoints.seoConfig).toBe("/api/v1/seo/config");
    expect(manifest.endpoints.seoSitemap).toBe("/api/v1/seo/sitemap");
    expect(manifest.endpoints.page).toBe("/api/v1/pages/:slug");
    expect(manifest.endpoints.blogPost).toBe("/api/v1/blog/posts/:slug");
    expect(manifest.endpoints.mediaContent).toBe("/api/v1/media/:id/content");
    expect(manifest.endpoints.catalogProducts).toBe("/api/v1/catalog/products");
    expect(manifest.endpoints.submitDiscussion).toBe("/api/v1/discussions");
  });
});

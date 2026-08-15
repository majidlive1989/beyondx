import type { HttpRouteDefinition } from "@beyondx/core";

export interface ThemeDeliveryManifest {
  platform: "BeyondX";
  apiVersion: "v1";
  sdkPackage: "@beyondx/theme-sdk";
  capabilities: {
    content: true;
    dynamicData: true;
    siteGlobals: true;
    corporateContent: true;
    navigation: true;
    forms: true;
    seo: true;
    publicMedia: true;
    catalog: boolean;
    discussions: boolean;
    commerce: boolean;
  };
  endpoints: {
    content: "/api/v1/content/:apiId";
    contentEntry: "/api/v1/content/:apiId/:slug";
    dynamicData: "/api/v1/data/:schemaKey";
    dynamicRecord: "/api/v1/data/:schemaKey/:id";
    siteSettings: "/api/v1/site/settings";
    navigation: "/api/v1/navigation";
    contactForm: "/api/v1/forms/contact";
    seoConfig: "/api/v1/seo/config";
    seoSitemap: "/api/v1/seo/sitemap";
    pages: "/api/v1/pages";
    page: "/api/v1/pages/:slug";
    blogPosts: "/api/v1/blog/posts";
    blogPost: "/api/v1/blog/posts/:slug";
    blogCategories: "/api/v1/blog/categories";
    blogTags: "/api/v1/blog/tags";
    media: "/api/v1/media/:id";
    mediaContent: "/api/v1/media/:id/content";
    catalogProducts: "/api/v1/catalog/products" | null;
    catalogProduct: "/api/v1/catalog/products/:slug" | null;
    discussions: "/api/v1/discussions/:sourceType/:sourceId" | null;
    submitDiscussion: "/api/v1/discussions" | null;
  };
}

export interface ThemeRouteOptions {
  isPluginActive: (packageName: string) => boolean;
}

export function createThemeRoutes(options: ThemeRouteOptions): HttpRouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/v1/theme/manifest",
      summary: "Discover public delivery capabilities available to a frontend theme",
      tags: ["Theme"],
      public: true,
      schema: { response: { 200: manifestJsonSchema } },
      handler: () => Promise.resolve({ body: buildThemeDeliveryManifest(options) }),
    },
  ];
}

export function buildThemeDeliveryManifest(options: ThemeRouteOptions): ThemeDeliveryManifest {
  const catalog = options.isPluginActive("@beyondx/plugin-catalog");
  const discussions = options.isPluginActive("@beyondx/plugin-discussion");
  const commerce = options.isPluginActive("@beyondx/plugin-commerce");

  return {
    platform: "BeyondX",
    apiVersion: "v1",
    sdkPackage: "@beyondx/theme-sdk",
    capabilities: {
      content: true,
      dynamicData: true,
      siteGlobals: true,
      corporateContent: true,
      navigation: true,
      forms: true,
      seo: true,
      publicMedia: true,
      catalog,
      discussions,
      commerce,
    },
    endpoints: {
      content: "/api/v1/content/:apiId",
      contentEntry: "/api/v1/content/:apiId/:slug",
      dynamicData: "/api/v1/data/:schemaKey",
      dynamicRecord: "/api/v1/data/:schemaKey/:id",
      siteSettings: "/api/v1/site/settings",
      navigation: "/api/v1/navigation",
      contactForm: "/api/v1/forms/contact",
      seoConfig: "/api/v1/seo/config",
      seoSitemap: "/api/v1/seo/sitemap",
      pages: "/api/v1/pages",
      page: "/api/v1/pages/:slug",
      blogPosts: "/api/v1/blog/posts",
      blogPost: "/api/v1/blog/posts/:slug",
      blogCategories: "/api/v1/blog/categories",
      blogTags: "/api/v1/blog/tags",
      media: "/api/v1/media/:id",
      mediaContent: "/api/v1/media/:id/content",
      catalogProducts: catalog ? "/api/v1/catalog/products" : null,
      catalogProduct: catalog ? "/api/v1/catalog/products/:slug" : null,
      discussions: discussions ? "/api/v1/discussions/:sourceType/:sourceId" : null,
      submitDiscussion: discussions ? "/api/v1/discussions" : null,
    },
  };
}

const nullableString = (value: string) => ({ anyOf: [{ type: "string", const: value }, { type: "null" }] });
const manifestJsonSchema = {
  type: "object",
  required: ["platform", "apiVersion", "sdkPackage", "capabilities", "endpoints"],
  properties: {
    platform: { type: "string", const: "BeyondX" },
    apiVersion: { type: "string", const: "v1" },
    sdkPackage: { type: "string", const: "@beyondx/theme-sdk" },
    capabilities: {
      type: "object",
      required: ["content", "dynamicData", "siteGlobals", "corporateContent", "navigation", "forms", "seo", "publicMedia", "catalog", "discussions", "commerce"],
      properties: {
        content: { type: "boolean" },
        dynamicData: { type: "boolean" },
        siteGlobals: { type: "boolean" },
        corporateContent: { type: "boolean" },
        navigation: { type: "boolean" },
        forms: { type: "boolean" },
        seo: { type: "boolean" },
        publicMedia: { type: "boolean" },
        catalog: { type: "boolean" },
        discussions: { type: "boolean" },
        commerce: { type: "boolean" },
      },
    },
    endpoints: {
      type: "object",
      required: ["content", "contentEntry", "dynamicData", "dynamicRecord", "siteSettings", "navigation", "contactForm", "seoConfig", "seoSitemap", "pages", "page", "blogPosts", "blogPost", "blogCategories", "blogTags", "media", "mediaContent", "catalogProducts", "catalogProduct", "discussions", "submitDiscussion"],
      properties: {
        content: { type: "string", const: "/api/v1/content/:apiId" },
        contentEntry: { type: "string", const: "/api/v1/content/:apiId/:slug" },
        dynamicData: { type: "string", const: "/api/v1/data/:schemaKey" },
        dynamicRecord: { type: "string", const: "/api/v1/data/:schemaKey/:id" },
        siteSettings: { type: "string", const: "/api/v1/site/settings" },
        navigation: { type: "string", const: "/api/v1/navigation" },
        contactForm: { type: "string", const: "/api/v1/forms/contact" },
        seoConfig: { type: "string", const: "/api/v1/seo/config" },
        seoSitemap: { type: "string", const: "/api/v1/seo/sitemap" },
        pages: { type: "string", const: "/api/v1/pages" },
        page: { type: "string", const: "/api/v1/pages/:slug" },
        blogPosts: { type: "string", const: "/api/v1/blog/posts" },
        blogPost: { type: "string", const: "/api/v1/blog/posts/:slug" },
        blogCategories: { type: "string", const: "/api/v1/blog/categories" },
        blogTags: { type: "string", const: "/api/v1/blog/tags" },
        media: { type: "string", const: "/api/v1/media/:id" },
        mediaContent: { type: "string", const: "/api/v1/media/:id/content" },
        catalogProducts: nullableString("/api/v1/catalog/products"),
        catalogProduct: nullableString("/api/v1/catalog/products/:slug"),
        discussions: nullableString("/api/v1/discussions/:sourceType/:sourceId"),
        submitDiscussion: nullableString("/api/v1/discussions"),
      },
    },
  },
};

import type { HttpRouteDefinition } from "@beyondx/core";

export interface ThemeDeliveryManifest {
  platform: "BeyondX";
  apiVersion: "v1";
  sdkPackage: "@beyondx/theme-sdk";
  capabilities: {
    content: true;
    dynamicData: true;
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
      required: ["content", "dynamicData", "publicMedia", "catalog", "discussions", "commerce"],
      properties: {
        content: { type: "boolean" },
        dynamicData: { type: "boolean" },
        publicMedia: { type: "boolean" },
        catalog: { type: "boolean" },
        discussions: { type: "boolean" },
        commerce: { type: "boolean" },
      },
    },
    endpoints: {
      type: "object",
      required: ["content", "contentEntry", "dynamicData", "dynamicRecord", "media", "mediaContent", "catalogProducts", "catalogProduct", "discussions", "submitDiscussion"],
      properties: {
        content: { type: "string", const: "/api/v1/content/:apiId" },
        contentEntry: { type: "string", const: "/api/v1/content/:apiId/:slug" },
        dynamicData: { type: "string", const: "/api/v1/data/:schemaKey" },
        dynamicRecord: { type: "string", const: "/api/v1/data/:schemaKey/:id" },
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

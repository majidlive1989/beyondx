import { describe, expect, it, vi } from "vitest";
import { createSchemaRoutes } from "../src/api/routes.js";
import type { SchemaService } from "../src/application/schema-service.js";

const now = "2026-08-15T00:00:00.000Z";

function pageResult(items: unknown[], page = 1, pageCount = 1) {
  return { items, page, pageSize: 100, total: items.length, pageCount };
}

describe("Public SEO delivery", () => {
  it("returns site SEO defaults from the active site settings record", async () => {
    const listRecords = vi.fn().mockResolvedValue({
      items: [{
        id: "settings-1",
        schemaId: "site-settings",
        schemaKey: "site-settings",
        status: "ACTIVE",
        values: {
          siteName: "Example",
          siteUrl: "https://example.com/",
          description: "Fallback description",
          seoTitle: "Example Company",
          seoDescription: "SEO description",
          seoImage: "media-og",
          defaultLocale: "en",
          allowSearchIndexing: true,
        },
        createdById: null,
        updatedById: null,
        createdAt: now,
        updatedAt: now,
      }],
      page: 1,
      pageSize: 1,
      total: 1,
      pageCount: 1,
    });

    const routes = createSchemaRoutes({ listRecords } as unknown as SchemaService);
    const route = routes.find((candidate) => candidate.path === "/api/v1/seo/config");
    expect(route).toBeDefined();

    const response = await route!.handler({} as never);
    expect(response.body).toEqual({
      seo: {
        siteUrl: "https://example.com",
        siteName: "Example",
        defaultTitle: "Example Company",
        defaultDescription: "SEO description",
        defaultImageId: "media-og",
        defaultLocale: "en",
        indexingAllowed: true,
      },
    });
  });

  it("builds sitemap paths from active pages and posts and excludes noIndex records", async () => {
    const listRecords = vi.fn((schemaKey: string) => {
      if (schemaKey === "site-settings") {
        return Promise.resolve({
          items: [{
            id: "settings-1",
            schemaId: "site-settings",
            schemaKey: "site-settings",
            status: "ACTIVE",
            values: { siteName: "Example", defaultLocale: "en", allowSearchIndexing: true },
            createdById: null,
            updatedById: null,
            createdAt: now,
            updatedAt: now,
          }],
          page: 1,
          pageSize: 1,
          total: 1,
          pageCount: 1,
        });
      }
      if (schemaKey === "site-page") {
        return Promise.resolve(pageResult([
          {
            id: "page-home",
            schemaId: "site-page",
            schemaKey: "site-page",
            status: "ACTIVE",
            values: { title: "Home", slug: "home", locale: "en" },
            createdById: null,
            updatedById: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "page-private",
            schemaId: "site-page",
            schemaKey: "site-page",
            status: "ACTIVE",
            values: { title: "Hidden", slug: "hidden", noIndex: true },
            createdById: null,
            updatedById: null,
            createdAt: now,
            updatedAt: now,
          },
        ]));
      }
      if (schemaKey === "blog-post") {
        return Promise.resolve(pageResult([
          {
            id: "post-1",
            schemaId: "blog-post",
            schemaKey: "blog-post",
            status: "ACTIVE",
            values: { title: "Hello", slug: "hello", locale: "fa", noIndex: false },
            createdById: null,
            updatedById: null,
            createdAt: now,
            updatedAt: "2026-08-15T01:00:00.000Z",
          },
        ]));
      }
      return Promise.resolve(pageResult([]));
    });

    const routes = createSchemaRoutes({ listRecords } as unknown as SchemaService);
    const route = routes.find((candidate) => candidate.path === "/api/v1/seo/sitemap");
    expect(route).toBeDefined();

    const response = await route!.handler({} as never);
    expect(response.body).toEqual({
      entries: [
        { path: "/", kind: "PAGE", slug: "home", locale: "en", lastModified: now },
        { path: "/blog/hello", kind: "BLOG_POST", slug: "hello", locale: "fa", lastModified: "2026-08-15T01:00:00.000Z" },
      ],
    });
  });

  it("returns an empty sitemap when global indexing is disabled", async () => {
    const listRecords = vi.fn().mockResolvedValue({
      items: [{
        id: "settings-1",
        schemaId: "site-settings",
        schemaKey: "site-settings",
        status: "ACTIVE",
        values: { allowSearchIndexing: false },
        createdById: null,
        updatedById: null,
        createdAt: now,
        updatedAt: now,
      }],
      page: 1,
      pageSize: 1,
      total: 1,
      pageCount: 1,
    });

    const routes = createSchemaRoutes({ listRecords } as unknown as SchemaService);
    const route = routes.find((candidate) => candidate.path === "/api/v1/seo/sitemap");
    const response = await route!.handler({} as never);

    expect(response.body).toEqual({ entries: [] });
    expect(listRecords).toHaveBeenCalledTimes(1);
  });
});

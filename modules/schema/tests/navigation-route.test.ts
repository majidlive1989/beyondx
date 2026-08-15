import { describe, expect, it, vi } from "vitest";
import { createSchemaRoutes } from "../src/api/routes.js";
import type { SchemaService } from "../src/application/schema-service.js";

describe("Public navigation delivery", () => {
  it("resolves active page links and hides disabled or missing links", async () => {
    const listRecords = vi.fn().mockResolvedValue({
      items: [{
        id: "navigation-1",
        schemaId: "site-navigation",
        schemaKey: "site-navigation",
        status: "ACTIVE",
        values: {
          headerItems: [
            { label: "Home", type: "PAGE", pageId: "page-home", style: "LINK", openInNewTab: false, enabled: true },
            { label: "Blog", type: "BLOG", style: "LINK", openInNewTab: false, enabled: true },
            { label: "Hidden", type: "CUSTOM", url: "/hidden", style: "LINK", openInNewTab: false, enabled: false },
            { label: "Missing", type: "PAGE", pageId: "page-missing", style: "LINK", openInNewTab: false, enabled: true },
          ],
          footerItems: [
            { label: "External", type: "CUSTOM", url: "https://example.com", style: "BUTTON", openInNewTab: true, enabled: true },
          ],
        },
        createdById: null,
        updatedById: null,
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
      }],
      page: 1,
      pageSize: 1,
      total: 1,
      pageCount: 1,
    });
    const getRecord = vi.fn((schemaKey: string, id: string) => {
      if (schemaKey === "site-page" && id === "page-home") {
        return Promise.resolve({
          id,
          schemaId: "site-page",
          schemaKey: "site-page",
          status: "ACTIVE",
          values: { title: "Home", slug: "home" },
          createdById: null,
          updatedById: null,
          createdAt: "2026-08-15T00:00:00.000Z",
          updatedAt: "2026-08-15T00:00:00.000Z",
        });
      }
      return Promise.reject(new Error("not public"));
    });

    const routes = createSchemaRoutes({ listRecords, getRecord } as unknown as SchemaService);
    const route = routes.find((candidate) => candidate.path === "/api/v1/navigation");
    expect(route).toBeDefined();

    const response = await route!.handler({} as never);
    expect(response.body).toEqual({
      navigation: {
        header: [
          { label: "Home", href: "/", style: "LINK", openInNewTab: false },
          { label: "Blog", href: "/blog", style: "LINK", openInNewTab: false },
        ],
        footer: [
          { label: "External", href: "https://example.com", style: "BUTTON", openInNewTab: true },
        ],
      },
    });
    expect(listRecords).toHaveBeenCalledWith(
      "site-navigation",
      { page: 1, pageSize: 1, status: "ACTIVE" },
      true,
    );
    expect(getRecord).toHaveBeenCalledWith("site-page", "page-home", true);
  });
});

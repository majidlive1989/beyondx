import { describe, expect, it } from "vitest";
import { BeyondXApiError, createBeyondXThemeClient, type BeyondXFetch } from "../src/index.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("BeyondX theme SDK", () => {
  it("builds stable public content URLs", async () => {
    let requested = "";
    const fetcher: BeyondXFetch = (input) => {
      requested = String(input);
      return Promise.resolve(jsonResponse({ items: [], page: 2, pageSize: 10, total: 0, pageCount: 0 }));
    };
    const client = createBeyondXThemeClient({ baseUrl: "http://127.0.0.1:4000/", fetch: fetcher });
    await client.content.list("article", { locale: "fa", page: 2, pageSize: 10 });
    expect(requested).toBe("http://127.0.0.1:4000/api/v1/content/article?page=2&pageSize=10&locale=fa");
  });

  it("loads plugin capability discovery from the theme manifest", async () => {
    const fetcher: BeyondXFetch = () => Promise.resolve(jsonResponse({
      platform: "BeyondX",
      apiVersion: "v1",
      sdkPackage: "@beyondx/theme-sdk",
      capabilities: { content: true, dynamicData: true, publicMedia: false, catalog: true, discussions: false, commerce: false },
      endpoints: {},
    }));
    const manifest = await createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher }).manifest();
    expect(manifest.capabilities.catalog).toBe(true);
  });

  it("normalizes BeyondX error envelopes", async () => {
    const fetcher: BeyondXFetch = () => Promise.resolve(jsonResponse({ error: { code: "CATALOG_PRODUCT_NOT_FOUND", message: "Product not found" } }, 404));
    const client = createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher });
    const request = client.catalog.getProduct("missing");

    await expect(request).rejects.toBeInstanceOf(BeyondXApiError);
    await expect(request).rejects.toMatchObject({
      status: 404,
      code: "CATALOG_PRODUCT_NOT_FOUND",
    });
  });
});

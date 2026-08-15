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
      capabilities: { content: true, dynamicData: true, siteGlobals: true, corporateContent: true, navigation: true, forms: true, seo: true, publicMedia: true, catalog: true, discussions: false, commerce: false },
      endpoints: {},
    }));
    const manifest = await createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher }).manifest();
    expect(manifest.capabilities.catalog).toBe(true);
  });

  it("reads the conventional public site settings single type", async () => {
    let requested = "";
    const fetcher: BeyondXFetch = (input) => {
      requested = String(input);
      return Promise.resolve(jsonResponse({
        settings: {
          id: "settings-1",
          schemaId: "schema-site-settings",
          schemaKey: "site-settings",
          status: "ACTIVE",
          values: { siteName: "Example", tagline: "Build anything" },
          createdById: null,
          updatedById: null,
          createdAt: "2026-08-12T00:00:00.000Z",
          updatedAt: "2026-08-12T00:00:00.000Z",
        },
      }));
    };
    const settings = await createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher }).site.getSettings();
    expect(requested).toBe("https://api.example.com/api/v1/site/settings");
    expect(settings?.values.siteName).toBe("Example");
  });

  it("reads corporate pages from the explicit public API", async () => {
    const requested: string[] = [];
    const fetcher: BeyondXFetch = (input) => {
      requested.push(String(input));
      if (String(input).endsWith("/api/v1/pages/about")) {
        return Promise.resolve(jsonResponse({
          page: {
            id: "page-1",
            schemaId: "site-page-schema",
            schemaKey: "site-page",
            status: "ACTIVE",
            values: { title: "About", slug: "about" },
            createdById: null,
            updatedById: null,
            createdAt: "2026-08-12T00:00:00.000Z",
            updatedAt: "2026-08-12T00:00:00.000Z",
          },
        }));
      }
      return Promise.resolve(jsonResponse({ items: [], page: 1, pageSize: 12, total: 0, pageCount: 1 }));
    };
    const client = createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher });
    await client.pages.list({ page: 1, pageSize: 12 });
    const page = await client.pages.get("about");
    expect(requested).toEqual([
      "https://api.example.com/api/v1/pages?page=1&pageSize=12",
      "https://api.example.com/api/v1/pages/about",
    ]);
    expect(page.values.title).toBe("About");
  });

  it("reads blog posts, categories and tags from explicit public APIs", async () => {
    const requested: string[] = [];
    const fetcher: BeyondXFetch = (input) => {
      requested.push(String(input));
      if (String(input).endsWith("/api/v1/blog/posts/hello-beyondx")) {
        return Promise.resolve(jsonResponse({
          post: {
            id: "post-1",
            schemaId: "blog-post-schema",
            schemaKey: "blog-post",
            status: "ACTIVE",
            values: { title: "Hello BeyondX", slug: "hello-beyondx" },
            createdById: null,
            updatedById: null,
            createdAt: "2026-08-12T00:00:00.000Z",
            updatedAt: "2026-08-12T00:00:00.000Z",
          },
        }));
      }
      return Promise.resolve(jsonResponse({ items: [], page: 1, pageSize: 30, total: 0, pageCount: 1 }));
    };
    const client = createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher });
    await client.blog.listPosts();
    const post = await client.blog.getPost("hello-beyondx");
    await client.blog.listCategories();
    await client.blog.listTags();
    expect(requested).toEqual([
      "https://api.example.com/api/v1/blog/posts",
      "https://api.example.com/api/v1/blog/posts/hello-beyondx",
      "https://api.example.com/api/v1/blog/categories",
      "https://api.example.com/api/v1/blog/tags",
    ]);
    expect(post.values.slug).toBe("hello-beyondx");
  });

  it("reads resolved website navigation from the explicit public API", async () => {
    let requested = "";
    const fetcher: BeyondXFetch = (input) => {
      requested = String(input);
      return Promise.resolve(jsonResponse({
        navigation: {
          header: [{ label: "About", href: "/about", style: "LINK", openInNewTab: false }],
          footer: [{ label: "Contact", href: "/contact", style: "LINK", openInNewTab: false }],
        },
      }));
    };
    const navigation = await createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher }).navigation.get();
    expect(requested).toBe("https://api.example.com/api/v1/navigation");
    expect(navigation.header[0]?.href).toBe("/about");
    expect(navigation.footer[0]?.label).toBe("Contact");
  });


  it("submits the contact form through the stable forms API", async () => {
    let requested = "";
    let method = "";
    let body = "";
    const fetcher: BeyondXFetch = (input, init) => {
      requested = String(input);
      method = init?.method ?? "";
      body = typeof init?.body === "string" ? init.body : "";
      return Promise.resolve(jsonResponse({ submitted: true }, 201));
    };
    const client = createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher });
    const result = await client.forms.submit("contact", {
      name: "Ali Example",
      email: "ali@example.com",
      subject: "Hello",
      message: "I would like to know more.",
      pageUrl: "/contact",
    });
    expect(requested).toBe("https://api.example.com/api/v1/forms/contact");
    expect(method).toBe("POST");
    expect(JSON.parse(body)).toMatchObject({ email: "ali@example.com", message: "I would like to know more." });
    expect(result.submitted).toBe(true);
  });

  it("reads SEO defaults and sitemap entries from stable public APIs", async () => {
    const requested: string[] = [];
    const fetcher: BeyondXFetch = (input) => {
      requested.push(String(input));
      if (String(input).endsWith("/api/v1/seo/config")) {
        return Promise.resolve(jsonResponse({
          seo: {
            siteUrl: "https://example.com",
            siteName: "Example",
            defaultTitle: "Example Company",
            defaultDescription: "Corporate website",
            defaultImageId: "media-og",
            defaultLocale: "en",
            indexingAllowed: true,
          },
        }));
      }
      return Promise.resolve(jsonResponse({
        entries: [{ path: "/about", kind: "PAGE", slug: "about", locale: "en", lastModified: "2026-08-15T00:00:00.000Z" }],
      }));
    };
    const client = createBeyondXThemeClient({ baseUrl: "https://api.example.com", fetch: fetcher });
    const config = await client.seo.getConfig();
    const sitemap = await client.seo.getSitemap();
    expect(requested).toEqual([
      "https://api.example.com/api/v1/seo/config",
      "https://api.example.com/api/v1/seo/sitemap",
    ]);
    expect(config.indexingAllowed).toBe(true);
    expect(sitemap.entries[0]?.path).toBe("/about");
  });

  it("builds public media URLs and reads media metadata", async () => {
    let requested = "";
    const fetcher: BeyondXFetch = (input) => {
      requested = String(input);
      return Promise.resolve(jsonResponse({
        asset: {
          id: "asset 1",
          originalName: "hero.png",
          fileName: "hero.png",
          mimeType: "image/png",
          kind: "IMAGE",
          sizeBytes: 24,
          checksumSha256: "abc",
          width: 800,
          height: 600,
          altText: "Hero",
          title: null,
          metadata: null,
          visibility: "PUBLIC",
          contentUrl: "/api/v1/media/asset%201/content",
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
      }));
    };
    const client = createBeyondXThemeClient({ baseUrl: "https://api.example.com/", fetch: fetcher });
    const asset = await client.media.get("asset 1");
    expect(requested).toBe("https://api.example.com/api/v1/media/asset%201");
    expect(client.media.url(asset)).toBe("https://api.example.com/api/v1/media/asset%201/content");
    expect(client.media.metadataUrl(asset)).toBe("https://api.example.com/api/v1/media/asset%201");
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

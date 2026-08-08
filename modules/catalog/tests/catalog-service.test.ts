import { describe, expect, it, vi } from "vitest";
import type { CatalogRepository } from "../src/application/contracts.js";
import { CatalogService } from "../src/application/catalog-service.js";
import type { AttributeValue, Product, ProductVariant } from "../src/domain/models.js";

const now = new Date("2026-08-07T00:00:00.000Z");

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    name: "Loop T1",
    slug: "loop-t1",
    description: null,
    status: "DRAFT",
    brandId: null,
    brand: null,
    categories: [],
    media: [],
    variants: [],
    customFields: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "variant-1",
    productId: "product-1",
    title: "Blue / 30mg",
    sku: "LOOP-T1-BLUE-30",
    status: "ACTIVE",
    position: 0,
    attributes: [],
    customFields: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function value(id: string, attributeId: string, name: string): AttributeValue {
  return {
    id,
    attributeId,
    value: name,
    slug: name.toLowerCase(),
    position: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function repository(stubs: Partial<CatalogRepository>): CatalogRepository {
  return stubs as unknown as CatalogRepository;
}

describe("CatalogService", () => {
  it("normalizes SKU and resolves one value per attribute", async () => {
    const createVariant = vi.fn().mockImplementation((input: { sku: string }) =>
      Promise.resolve(variant({ sku: input.sku })),
    );
    const repo = repository({
      getProduct: () => Promise.resolve(product()),
      getAttributeValues: () => Promise.resolve([
        value("blue", "color", "Blue"),
        value("30mg", "nicotine", "30mg"),
      ]),
      createVariant,
      audit: () => Promise.resolve(),
    });
    const service = new CatalogService(repo);

    const created = await service.createVariant(
      "product-1",
      {
        title: "Blue / 30mg",
        sku: " loop-t1-blue-30 ",
        status: "ACTIVE",
        position: 0,
        attributeValueIds: ["blue", "30mg"],
      },
      { actorId: "admin-1" },
    );

    expect(created.sku).toBe("LOOP-T1-BLUE-30");
    expect(createVariant).toHaveBeenCalledTimes(1);
    expect(createVariant.mock.calls[0]?.[1]).toEqual([
      { attributeId: "color", attributeValueId: "blue" },
      { attributeId: "nicotine", attributeValueId: "30mg" },
    ]);
  });

  it("rejects two values from the same attribute on a variant", async () => {
    const repo = repository({
      getProduct: () => Promise.resolve(product()),
      getAttributeValues: () => Promise.resolve([
        value("blue", "color", "Blue"),
        value("pink", "color", "Pink"),
      ]),
    });
    const service = new CatalogService(repo);

    await expect(
      service.createVariant(
        "product-1",
        {
          title: "Invalid",
          sku: "INVALID-1",
          status: "ACTIVE",
          position: 0,
          attributeValueIds: ["blue", "pink"],
        },
        { actorId: "admin-1" },
      ),
    ).rejects.toMatchObject({ code: "CATALOG_DUPLICATE_VARIANT_ATTRIBUTE", statusCode: 400 });
  });

  it("requires an active variant before activating a product", async () => {
    const repo = repository({
      getProduct: () => Promise.resolve(product()),
      countActiveVariants: () => Promise.resolve(0),
      updateProduct: () => Promise.resolve(product({ status: "ACTIVE" })),
      audit: () => Promise.resolve(),
    });
    const service = new CatalogService(repo);

    await expect(
      service.updateProduct("product-1", { status: "ACTIVE" }, { actorId: "admin-1" }),
    ).rejects.toMatchObject({ code: "CATALOG_ACTIVE_PRODUCT_REQUIRES_VARIANT", statusCode: 400 });
  });

  it("accepts only image assets for product media", async () => {
    const repo = repository({
      imageMediaExist: () => Promise.resolve(false),
      categoriesExist: () => Promise.resolve(true),
      createProduct: () => Promise.resolve(product()),
      audit: () => Promise.resolve(),
    });
    const service = new CatalogService(repo);

    await expect(
      service.createProduct(
        {
          name: "Loop T1",
          slug: "loop-t1",
          status: "DRAFT",
          categoryIds: [],
          mediaAssetIds: ["pdf-asset"],
        },
        { actorId: "admin-1" },
      ),
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_INVALID", statusCode: 400 });
  });
});

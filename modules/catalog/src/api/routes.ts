import {
  AppError,
  type HttpRequestContext,
  type HttpRouteDefinition,
} from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type {
  AttributeInput,
  AttributeValueInput,
  BrandInput,
  CategoryInput,
  ProductCreateInput,
  ProductUpdateInput,
  VariantCreateInput,
  VariantUpdateInput,
} from "../application/contracts.js";
import type { CatalogService } from "../application/catalog-service.js";
import type {
  AttributeValue,
  Brand,
  CatalogAttribute,
  Category,
  Product,
  ProductListInput,
  PublicProductListInput,
} from "../domain/models.js";

const slug = z.string().trim().min(1).max(160);
const id = z.string().trim().min(1).max(160);
const nullableText = (max: number) => z.string().max(max).nullable();
const position = z.coerce.number().int().min(0).max(1_000_000).default(0);

const idParamsSchema = z.object({ id });
const slugParamsSchema = z.object({ slug });

const brandCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug,
  description: nullableText(1000).optional(),
}).transform((value): BrandInput => ({
  name: value.name,
  slug: value.slug,
  ...(value.description === undefined ? {} : { description: value.description }),
}));

const brandUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: slug.optional(),
  description: nullableText(1000).optional(),
}).transform((value): Partial<BrandInput> => ({
  ...(value.name === undefined ? {} : { name: value.name }),
  ...(value.slug === undefined ? {} : { slug: value.slug }),
  ...(value.description === undefined ? {} : { description: value.description }),
}));

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug,
  description: nullableText(1000).optional(),
  parentId: id.nullable().optional(),
  position,
}).transform((value): CategoryInput => ({
  name: value.name,
  slug: value.slug,
  ...(value.description === undefined ? {} : { description: value.description }),
  ...(value.parentId === undefined ? {} : { parentId: value.parentId }),
  position: value.position,
}));

const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: slug.optional(),
  description: nullableText(1000).optional(),
  parentId: id.nullable().optional(),
  position: z.coerce.number().int().min(0).max(1_000_000).optional(),
}).transform((value): Partial<CategoryInput> => ({
  ...(value.name === undefined ? {} : { name: value.name }),
  ...(value.slug === undefined ? {} : { slug: value.slug }),
  ...(value.description === undefined ? {} : { description: value.description }),
  ...(value.parentId === undefined ? {} : { parentId: value.parentId }),
  ...(value.position === undefined ? {} : { position: value.position }),
}));

const attributeCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug,
  position,
}).transform((value): AttributeInput => ({ ...value }));

const attributeUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: slug.optional(),
  position: z.coerce.number().int().min(0).max(1_000_000).optional(),
}).transform((value): Partial<AttributeInput> => ({
  ...(value.name === undefined ? {} : { name: value.name }),
  ...(value.slug === undefined ? {} : { slug: value.slug }),
  ...(value.position === undefined ? {} : { position: value.position }),
}));

const attributeValueCreateSchema = z.object({
  value: z.string().min(1).max(120),
  slug,
  position,
}).transform((value): AttributeValueInput => ({ ...value }));

const attributeValueUpdateSchema = z.object({
  value: z.string().min(1).max(120).optional(),
  slug: slug.optional(),
  position: z.coerce.number().int().min(0).max(1_000_000).optional(),
}).transform((value): Partial<AttributeValueInput> => ({
  ...(value.value === undefined ? {} : { value: value.value }),
  ...(value.slug === undefined ? {} : { slug: value.slug }),
  ...(value.position === undefined ? {} : { position: value.position }),
}));

const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
const variantStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

const productCreateSchema = z.object({
  name: z.string().min(1).max(180),
  slug,
  description: nullableText(10_000).optional(),
  status: productStatusSchema.default("DRAFT"),
  brandId: id.nullable().optional(),
  categoryIds: z.array(id).max(100).default([]),
  mediaAssetIds: z.array(id).max(100).default([]),
  customFields: z.record(z.unknown()).optional(),
}).transform((value): ProductCreateInput => ({
  name: value.name,
  slug: value.slug,
  ...(value.description === undefined ? {} : { description: value.description }),
  status: value.status,
  ...(value.brandId === undefined ? {} : { brandId: value.brandId }),
  categoryIds: value.categoryIds,
  mediaAssetIds: value.mediaAssetIds,
  ...(value.customFields === undefined ? {} : { customFields: value.customFields }),
}));

const productUpdateSchema = z.object({
  name: z.string().min(1).max(180).optional(),
  slug: slug.optional(),
  description: nullableText(10_000).optional(),
  status: productStatusSchema.optional(),
  brandId: id.nullable().optional(),
  categoryIds: z.array(id).max(100).optional(),
  mediaAssetIds: z.array(id).max(100).optional(),
  customFields: z.record(z.unknown()).optional(),
}).transform((value): ProductUpdateInput => ({
  ...(value.name === undefined ? {} : { name: value.name }),
  ...(value.slug === undefined ? {} : { slug: value.slug }),
  ...(value.description === undefined ? {} : { description: value.description }),
  ...(value.status === undefined ? {} : { status: value.status }),
  ...(value.brandId === undefined ? {} : { brandId: value.brandId }),
  ...(value.categoryIds === undefined ? {} : { categoryIds: value.categoryIds }),
  ...(value.mediaAssetIds === undefined ? {} : { mediaAssetIds: value.mediaAssetIds }),
  ...(value.customFields === undefined ? {} : { customFields: value.customFields }),
}));

const variantCreateBodySchema = z.object({
  title: z.string().min(1).max(160),
  sku: z.string().min(1).max(64),
  status: variantStatusSchema.default("ACTIVE"),
  position,
  attributeValueIds: z.array(id).max(50).default([]),
  customFields: z.record(z.unknown()).optional(),
}).transform((value): Omit<VariantCreateInput, "productId"> => ({
  title: value.title,
  sku: value.sku,
  status: value.status,
  position: value.position,
  attributeValueIds: value.attributeValueIds,
  ...(value.customFields === undefined ? {} : { customFields: value.customFields }),
}));

const variantUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  sku: z.string().min(1).max(64).optional(),
  status: variantStatusSchema.optional(),
  position: z.coerce.number().int().min(0).max(1_000_000).optional(),
  attributeValueIds: z.array(id).max(50).optional(),
  customFields: z.record(z.unknown()).optional(),
}).transform((value): VariantUpdateInput => ({
  ...(value.title === undefined ? {} : { title: value.title }),
  ...(value.sku === undefined ? {} : { sku: value.sku }),
  ...(value.status === undefined ? {} : { status: value.status }),
  ...(value.position === undefined ? {} : { position: value.position }),
  ...(value.attributeValueIds === undefined ? {} : { attributeValueIds: value.attributeValueIds }),
  ...(value.customFields === undefined ? {} : { customFields: value.customFields }),
}));

const adminProductListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(180).optional(),
  status: productStatusSchema.optional(),
  brandId: id.optional(),
  categoryId: id.optional(),
}).transform((value): ProductListInput => ({
  page: value.page,
  pageSize: value.pageSize,
  ...(value.search === undefined || value.search === "" ? {} : { search: value.search }),
  ...(value.status === undefined ? {} : { status: value.status }),
  ...(value.brandId === undefined ? {} : { brandId: value.brandId }),
  ...(value.categoryId === undefined ? {} : { categoryId: value.categoryId }),
}));

const publicProductListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  search: z.string().trim().max(180).optional(),
  brand: slug.optional(),
  category: slug.optional(),
}).transform((value): PublicProductListInput => ({
  page: value.page,
  pageSize: value.pageSize,
  ...(value.search === undefined || value.search === "" ? {} : { search: value.search }),
  ...(value.brand === undefined ? {} : { brand: value.brand }),
  ...(value.category === undefined ? {} : { category: value.category }),
}));

export function createCatalogRoutes(service: CatalogService): HttpRouteDefinition[] {
  return [
    publicRoute("GET", "/api/v1/catalog/products", "List active catalog products", async (context) => ({
      body: publicPage(await service.listPublicProducts(parseInput(publicProductListSchema, context.query ?? {}))),
    }), { querystring: publicProductListJsonSchema, response: { 200: productPageSchema } }),
    publicRoute("GET", "/api/v1/catalog/products/:slug", "Read an active catalog product by slug", async (context) => {
      const params = parseInput(slugParamsSchema, context.params);
      return { body: { product: publicProduct(await service.getPublicProductBySlug(params.slug)) } };
    }, { params: slugParamsJsonSchema, response: { 200: productEnvelopeSchema } }),
    publicRoute("GET", "/api/v1/catalog/brands", "List catalog brands", async () => ({
      body: { items: (await service.listBrands()).map(publicBrand) },
    }), { response: { 200: brandListSchema } }),
    publicRoute("GET", "/api/v1/catalog/categories", "List catalog categories", async () => ({
      body: { items: (await service.listCategories()).map(publicCategory) },
    }), { response: { 200: categoryListSchema } }),

    protectedRoute("GET", "/api/v1/admin/catalog/brands", "List catalog brands", "catalog.products.read", async () => ({
      body: { items: (await service.listBrands()).map(publicBrand) },
    }), { response: { 200: brandListSchema } }),
    protectedRoute("POST", "/api/v1/admin/catalog/brands", "Create a catalog brand", "catalog.brands.manage", async (context) => ({
      statusCode: 201,
      body: { brand: publicBrand(await service.createBrand(parseInput(brandCreateSchema, context.body), actionMetadata(context))) },
    }), { body: brandBodyJsonSchema, response: { 201: brandEnvelopeSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/catalog/brands/:id", "Update a catalog brand", "catalog.brands.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { brand: publicBrand(await service.updateBrand(params.id, parseInput(brandUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: brandUpdateJsonSchema, response: { 200: brandEnvelopeSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/catalog/brands/:id", "Delete an unused catalog brand", "catalog.brands.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      await service.deleteBrand(params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),

    protectedRoute("GET", "/api/v1/admin/catalog/categories", "List catalog categories", "catalog.products.read", async () => ({
      body: { items: (await service.listCategories()).map(publicCategory) },
    }), { response: { 200: categoryListSchema } }),
    protectedRoute("POST", "/api/v1/admin/catalog/categories", "Create a catalog category", "catalog.categories.manage", async (context) => ({
      statusCode: 201,
      body: { category: publicCategory(await service.createCategory(parseInput(categoryCreateSchema, context.body), actionMetadata(context))) },
    }), { body: categoryBodyJsonSchema, response: { 201: categoryEnvelopeSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/catalog/categories/:id", "Update a catalog category", "catalog.categories.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { category: publicCategory(await service.updateCategory(params.id, parseInput(categoryUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: categoryUpdateJsonSchema, response: { 200: categoryEnvelopeSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/catalog/categories/:id", "Delete an unused catalog category", "catalog.categories.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      await service.deleteCategory(params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),

    protectedRoute("GET", "/api/v1/admin/catalog/attributes", "List catalog attributes and values", "catalog.products.read", async () => ({
      body: { items: (await service.listAttributes()).map(publicAttribute) },
    }), { response: { 200: attributeListSchema } }),
    protectedRoute("POST", "/api/v1/admin/catalog/attributes", "Create a catalog attribute", "catalog.attributes.manage", async (context) => ({
      statusCode: 201,
      body: { attribute: publicAttribute(await service.createAttribute(parseInput(attributeCreateSchema, context.body), actionMetadata(context))) },
    }), { body: attributeBodyJsonSchema, response: { 201: attributeEnvelopeSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/catalog/attributes/:id", "Update a catalog attribute", "catalog.attributes.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { attribute: publicAttribute(await service.updateAttribute(params.id, parseInput(attributeUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: attributeUpdateJsonSchema, response: { 200: attributeEnvelopeSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/catalog/attributes/:id", "Delete an unused catalog attribute", "catalog.attributes.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      await service.deleteAttribute(params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/catalog/attributes/:id/values", "Create an attribute value", "catalog.attributes.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return {
        statusCode: 201,
        body: { value: publicAttributeValue(await service.createAttributeValue(params.id, parseInput(attributeValueCreateSchema, context.body), actionMetadata(context))) },
      };
    }, { params: idParamsJsonSchema, body: attributeValueBodyJsonSchema, response: { 201: attributeValueEnvelopeSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/catalog/attribute-values/:id", "Update an attribute value", "catalog.attributes.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { value: publicAttributeValue(await service.updateAttributeValue(params.id, parseInput(attributeValueUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: attributeValueUpdateJsonSchema, response: { 200: attributeValueEnvelopeSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/catalog/attribute-values/:id", "Delete an unused attribute value", "catalog.attributes.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      await service.deleteAttributeValue(params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),

    protectedRoute("GET", "/api/v1/admin/catalog/custom-fields", "Read schema-driven Product and Variant field definitions", "catalog.products.read", async () => ({
      body: await service.getCustomFieldSchemas(),
    }), { response: { 200: catalogCustomFieldSchemasJsonSchema } }),

    protectedRoute("GET", "/api/v1/admin/catalog/products", "List catalog products", "catalog.products.read", async (context) => ({
      body: publicPage(await service.listProducts(parseInput(adminProductListSchema, context.query ?? {}))),
    }), { querystring: adminProductListJsonSchema, response: { 200: productPageSchema } }),
    protectedRoute("POST", "/api/v1/admin/catalog/products", "Create a draft catalog product", "catalog.products.create", async (context) => ({
      statusCode: 201,
      body: { product: publicProduct(await service.createProduct(parseInput(productCreateSchema, context.body), actionMetadata(context))) },
    }), { body: productBodyJsonSchema, response: { 201: productEnvelopeSchema } }),
    protectedRoute("GET", "/api/v1/admin/catalog/products/:id", "Read a catalog product", "catalog.products.read", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { product: publicProduct(await service.getProduct(params.id)) } };
    }, { params: idParamsJsonSchema, response: { 200: productEnvelopeSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/catalog/products/:id", "Update a catalog product", "catalog.products.update", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { product: publicProduct(await service.updateProduct(params.id, parseInput(productUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: productUpdateJsonSchema, response: { 200: productEnvelopeSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/catalog/products/:id", "Delete a catalog product", "catalog.products.delete", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      await service.deleteProduct(params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),
    protectedRoute("POST", "/api/v1/admin/catalog/products/:id/variants", "Create a product variant with a unique SKU", "catalog.variants.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return {
        statusCode: 201,
        body: { variant: publicVariant(await service.createVariant(params.id, parseInput(variantCreateBodySchema, context.body), actionMetadata(context))) },
      };
    }, { params: idParamsJsonSchema, body: variantBodyJsonSchema, response: { 201: variantEnvelopeSchema } }),
    protectedRoute("PATCH", "/api/v1/admin/catalog/variants/:id", "Update a product variant or SKU", "catalog.variants.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      return { body: { variant: publicVariant(await service.updateVariant(params.id, parseInput(variantUpdateSchema, context.body), actionMetadata(context))) } };
    }, { params: idParamsJsonSchema, body: variantUpdateJsonSchema, response: { 200: variantEnvelopeSchema } }),
    protectedRoute("DELETE", "/api/v1/admin/catalog/variants/:id", "Delete a product variant", "catalog.variants.manage", async (context) => {
      const params = parseInput(idParamsSchema, context.params);
      await service.deleteVariant(params.id, actionMetadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),
  ];
}

function publicRoute(
  method: HttpRouteDefinition["method"],
  path: string,
  summary: string,
  handler: HttpRouteDefinition["handler"],
  schema?: Record<string, unknown>,
): HttpRouteDefinition {
  return { method, path, summary, tags: ["Catalog"], public: true, ...(schema === undefined ? {} : { schema }), handler };
}

function protectedRoute(
  method: HttpRouteDefinition["method"],
  path: string,
  summary: string,
  permission: string,
  handler: HttpRouteDefinition["handler"],
  schema?: Record<string, unknown>,
): HttpRouteDefinition {
  return { method, path, summary, tags: ["Catalog Admin"], public: false, permission, ...(schema === undefined ? {} : { schema }), handler };
}

function actionMetadata(context: HttpRequestContext) {
  if (!context.principal) {
    throw new AppError({ code: "IDENTITY_AUTHENTICATION_REQUIRED", message: "Authentication is required", statusCode: 401 });
  }
  const userAgent = readHeader(context, "user-agent");
  return {
    actorId: context.principal.subject,
    requestId: context.requestId,
    ipAddress: context.ip,
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

function readHeader(context: HttpRequestContext, name: string): string | undefined {
  const value = context.headers[name];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

function publicBrand(brand: Brand) {
  return { ...brand, createdAt: brand.createdAt.toISOString(), updatedAt: brand.updatedAt.toISOString() };
}

function publicCategory(category: Category) {
  return { ...category, createdAt: category.createdAt.toISOString(), updatedAt: category.updatedAt.toISOString() };
}

function publicAttributeValue(value: AttributeValue) {
  return { ...value, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() };
}

function publicAttribute(attribute: CatalogAttribute) {
  return {
    ...attribute,
    values: attribute.values.map(publicAttributeValue),
    createdAt: attribute.createdAt.toISOString(),
    updatedAt: attribute.updatedAt.toISOString(),
  };
}

function publicVariant(variant: Product["variants"][number]) {
  return { ...variant, createdAt: variant.createdAt.toISOString(), updatedAt: variant.updatedAt.toISOString() };
}

function publicProduct(product: Product) {
  return {
    ...product,
    brand: product.brand ? publicBrand(product.brand) : null,
    categories: product.categories.map(publicCategory),
    variants: product.variants.map(publicVariant),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function publicPage(page: { items: Product[]; page: number; pageSize: number; total: number; pageCount: number }) {
  return { ...page, items: page.items.map(publicProduct) };
}

const idParamsJsonSchema = { type: "object", required: ["id"], properties: { id: { type: "string", minLength: 1 } } };
const slugParamsJsonSchema = { type: "object", required: ["slug"], properties: { slug: { type: "string", minLength: 1 } } };
const nullableString = (maxLength: number) => ({ anyOf: [{ type: "string", maxLength }, { type: "null" }] });

const brandBodyJsonSchema = { type: "object", required: ["name", "slug"], properties: { name: { type: "string", minLength: 1, maxLength: 120 }, slug: { type: "string", minLength: 1, maxLength: 160 }, description: nullableString(1000) } };
const brandUpdateJsonSchema = { type: "object", minProperties: 1, properties: brandBodyJsonSchema.properties };
const categoryBodyJsonSchema = { type: "object", required: ["name", "slug"], properties: { ...brandBodyJsonSchema.properties, parentId: { anyOf: [{ type: "string" }, { type: "null" }] }, position: { type: "integer", minimum: 0, default: 0 } } };
const categoryUpdateJsonSchema = { type: "object", minProperties: 1, properties: categoryBodyJsonSchema.properties };
const attributeBodyJsonSchema = { type: "object", required: ["name", "slug"], properties: { name: { type: "string", minLength: 1, maxLength: 120 }, slug: { type: "string", minLength: 1, maxLength: 160 }, position: { type: "integer", minimum: 0, default: 0 } } };
const attributeUpdateJsonSchema = { type: "object", minProperties: 1, properties: attributeBodyJsonSchema.properties };
const attributeValueBodyJsonSchema = { type: "object", required: ["value", "slug"], properties: { value: { type: "string", minLength: 1, maxLength: 120 }, slug: { type: "string", minLength: 1, maxLength: 160 }, position: { type: "integer", minimum: 0, default: 0 } } };
const attributeValueUpdateJsonSchema = { type: "object", minProperties: 1, properties: attributeValueBodyJsonSchema.properties };
const productBodyJsonSchema = { type: "object", required: ["name", "slug"], properties: { name: { type: "string", minLength: 1, maxLength: 180 }, slug: { type: "string", minLength: 1, maxLength: 160 }, description: nullableString(10_000), status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"], default: "DRAFT" }, brandId: { anyOf: [{ type: "string" }, { type: "null" }] }, categoryIds: { type: "array", items: { type: "string" }, maxItems: 100, default: [] }, mediaAssetIds: { type: "array", items: { type: "string" }, maxItems: 100, default: [] }, customFields: { type: "object", additionalProperties: true } } };
const productUpdateJsonSchema = { type: "object", minProperties: 1, properties: productBodyJsonSchema.properties };
const variantBodyJsonSchema = { type: "object", required: ["title", "sku"], properties: { title: { type: "string", minLength: 1, maxLength: 160 }, sku: { type: "string", minLength: 1, maxLength: 64 }, status: { type: "string", enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" }, position: { type: "integer", minimum: 0, default: 0 }, attributeValueIds: { type: "array", items: { type: "string" }, maxItems: 50, default: [] }, customFields: { type: "object", additionalProperties: true } } };
const variantUpdateJsonSchema = { type: "object", minProperties: 1, properties: variantBodyJsonSchema.properties };
const adminProductListJsonSchema = { type: "object", properties: { page: { type: "integer", minimum: 1, default: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100, default: 30 }, search: { type: "string", maxLength: 180 }, status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }, brandId: { type: "string" }, categoryId: { type: "string" } } };
const publicProductListJsonSchema = { type: "object", properties: { page: { type: "integer", minimum: 1, default: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100, default: 24 }, search: { type: "string", maxLength: 180 }, brand: { type: "string" }, category: { type: "string" } } };

const dateProps = { createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } };
const brandSchema = { type: "object", required: ["id", "name", "slug", "description", "createdAt", "updatedAt"], properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, description: nullableString(1000), ...dateProps } };
const categorySchema = { type: "object", required: ["id", "name", "slug", "description", "parentId", "position", "createdAt", "updatedAt"], properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, description: nullableString(1000), parentId: { anyOf: [{ type: "string" }, { type: "null" }] }, position: { type: "integer" }, ...dateProps } };
const attributeValueSchema = { type: "object", required: ["id", "attributeId", "value", "slug", "position", "createdAt", "updatedAt"], properties: { id: { type: "string" }, attributeId: { type: "string" }, value: { type: "string" }, slug: { type: "string" }, position: { type: "integer" }, ...dateProps } };
const attributeSchema = { type: "object", required: ["id", "name", "slug", "position", "values", "createdAt", "updatedAt"], properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, position: { type: "integer" }, values: { type: "array", items: attributeValueSchema }, ...dateProps } };
const selectionSchema = { type: "object", required: ["attributeId", "attributeName", "attributeSlug", "valueId", "value", "valueSlug"], properties: { attributeId: { type: "string" }, attributeName: { type: "string" }, attributeSlug: { type: "string" }, valueId: { type: "string" }, value: { type: "string" }, valueSlug: { type: "string" } } };
const variantSchema = { type: "object", required: ["id", "productId", "title", "sku", "status", "position", "attributes", "customFields", "createdAt", "updatedAt"], properties: { id: { type: "string" }, productId: { type: "string" }, title: { type: "string" }, sku: { type: "string" }, status: { type: "string", enum: ["ACTIVE", "DISABLED"] }, position: { type: "integer" }, attributes: { type: "array", items: selectionSchema }, customFields: { type: "object", additionalProperties: true }, ...dateProps } };
const mediaSchema = { type: "object", required: ["id", "originalName", "mimeType", "width", "height", "altText", "title", "position"], properties: { id: { type: "string" }, originalName: { type: "string" }, mimeType: { type: "string" }, width: { anyOf: [{ type: "integer" }, { type: "null" }] }, height: { anyOf: [{ type: "integer" }, { type: "null" }] }, altText: { anyOf: [{ type: "string" }, { type: "null" }] }, title: { anyOf: [{ type: "string" }, { type: "null" }] }, position: { type: "integer" } } };
const productSchema = { type: "object", required: ["id", "name", "slug", "description", "status", "brandId", "brand", "categories", "media", "variants", "customFields", "createdAt", "updatedAt"], properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, description: nullableString(10_000), status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }, brandId: { anyOf: [{ type: "string" }, { type: "null" }] }, brand: { anyOf: [brandSchema, { type: "null" }] }, categories: { type: "array", items: categorySchema }, media: { type: "array", items: mediaSchema }, variants: { type: "array", items: variantSchema }, customFields: { type: "object", additionalProperties: true }, ...dateProps } };

const brandEnvelopeSchema = { type: "object", required: ["brand"], properties: { brand: brandSchema } };
const brandListSchema = { type: "object", required: ["items"], properties: { items: { type: "array", items: brandSchema } } };
const categoryEnvelopeSchema = { type: "object", required: ["category"], properties: { category: categorySchema } };
const categoryListSchema = { type: "object", required: ["items"], properties: { items: { type: "array", items: categorySchema } } };
const attributeEnvelopeSchema = { type: "object", required: ["attribute"], properties: { attribute: attributeSchema } };
const attributeListSchema = { type: "object", required: ["items"], properties: { items: { type: "array", items: attributeSchema } } };
const attributeValueEnvelopeSchema = { type: "object", required: ["value"], properties: { value: attributeValueSchema } };
const productEnvelopeSchema = { type: "object", required: ["product"], properties: { product: productSchema } };
const catalogCustomFieldSchemasJsonSchema = { type: "object", required: ["productSchema", "variantSchema", "componentSchemas"], properties: { productSchema: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] }, variantSchema: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] }, componentSchemas: { type: "array", items: { type: "object", additionalProperties: true } } } };
const variantEnvelopeSchema = { type: "object", required: ["variant"], properties: { variant: variantSchema } };
const productPageSchema = { type: "object", required: ["items", "page", "pageSize", "total", "pageCount"], properties: { items: { type: "array", items: productSchema }, page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" }, pageCount: { type: "integer" } } };

import { AppError } from "@beyondx/core";
import type { DataSchema, SchemaService } from "@beyondx/module-schema";
import type {
  AttributeInput,
  AttributeValueInput,
  BrandInput,
  CatalogRepository,
  CategoryInput,
  ProductCreateInput,
  ProductUpdateInput,
  VariantCreateInput,
  VariantUpdateInput,
} from "./contracts.js";
import type {
  AttributeValue,
  Brand,
  CatalogAttribute,
  Category,
  Page,
  Product,
  ProductListInput,
  ProductVariant,
  PublicProductListInput,
} from "../domain/models.js";

export interface CatalogActionMetadata {
  actorId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly schemaService: SchemaService | null = null,
  ) {}

  async getCustomFieldSchemas(): Promise<{
    productSchema: DataSchema | null;
    variantSchema: DataSchema | null;
    componentSchemas: DataSchema[];
  }> {
    if (!this.schemaService) return { productSchema: null, variantSchema: null, componentSchemas: [] };
    const [productSchema, variantSchema, schemas] = await Promise.all([
      this.schemaService.getSchemaByKey("catalog.product"),
      this.schemaService.getSchemaByKey("catalog.variant"),
      this.schemaService.listSchemas(),
    ]);
    return {
      productSchema,
      variantSchema,
      componentSchemas: schemas.filter((schema) => schema.kind === "COMPONENT"),
    };
  }

  listBrands(): Promise<Brand[]> {
    return this.repository.listBrands();
  }

  async createBrand(input: BrandInput, metadata: CatalogActionMetadata): Promise<Brand> {
    const brand = await this.repository.createBrand(normalizeBrandInput(input));
    await this.audit(metadata, "catalog.brand.created", "Brand", brand.id, { slug: brand.slug });
    return brand;
  }

  async updateBrand(id: string, input: Partial<BrandInput>, metadata: CatalogActionMetadata): Promise<Brand> {
    await this.requireBrand(id);
    const normalized = normalizePartialBrandInput(input);
    requireChanges(normalized);
    const brand = await this.repository.updateBrand(id, normalized);
    await this.audit(metadata, "catalog.brand.updated", "Brand", id, { slug: brand.slug });
    return brand;
  }

  async deleteBrand(id: string, metadata: CatalogActionMetadata): Promise<void> {
    const brand = await this.requireBrand(id);
    if ((await this.repository.countProductsByBrand(id)) > 0) {
      throw new AppError({
        code: "CATALOG_BRAND_IN_USE",
        message: "Brand cannot be deleted while products reference it",
        statusCode: 409,
      });
    }
    await this.repository.deleteBrand(id);
    await this.audit(metadata, "catalog.brand.deleted", "Brand", id, { slug: brand.slug });
  }

  listCategories(): Promise<Category[]> {
    return this.repository.listCategories();
  }

  async createCategory(input: CategoryInput, metadata: CatalogActionMetadata): Promise<Category> {
    const normalized = normalizeCategoryInput(input);
    if (normalized.parentId) await this.requireCategory(normalized.parentId);
    const category = await this.repository.createCategory(normalized);
    await this.audit(metadata, "catalog.category.created", "Category", category.id, { slug: category.slug });
    return category;
  }

  async updateCategory(id: string, input: Partial<CategoryInput>, metadata: CatalogActionMetadata): Promise<Category> {
    await this.requireCategory(id);
    const normalized = normalizePartialCategoryInput(input);
    requireChanges(normalized);
    if (normalized.parentId !== undefined) {
      if (normalized.parentId === id) {
        throw new AppError({ code: "CATALOG_CATEGORY_CYCLE", message: "Category cannot be its own parent", statusCode: 400 });
      }
      if (normalized.parentId) {
        await this.assertCategoryParentIsSafe(id, normalized.parentId);
      }
    }
    const category = await this.repository.updateCategory(id, normalized);
    await this.audit(metadata, "catalog.category.updated", "Category", id, { slug: category.slug });
    return category;
  }

  async deleteCategory(id: string, metadata: CatalogActionMetadata): Promise<void> {
    const category = await this.requireCategory(id);
    if ((await this.repository.countProductsByCategory(id)) > 0) {
      throw new AppError({
        code: "CATALOG_CATEGORY_IN_USE",
        message: "Category cannot be deleted while products reference it",
        statusCode: 409,
      });
    }
    await this.repository.deleteCategory(id);
    await this.audit(metadata, "catalog.category.deleted", "Category", id, { slug: category.slug });
  }

  listAttributes(): Promise<CatalogAttribute[]> {
    return this.repository.listAttributes();
  }

  async createAttribute(input: AttributeInput, metadata: CatalogActionMetadata): Promise<CatalogAttribute> {
    const attribute = await this.repository.createAttribute(normalizeAttributeInput(input));
    await this.audit(metadata, "catalog.attribute.created", "CatalogAttribute", attribute.id, { slug: attribute.slug });
    return attribute;
  }

  async updateAttribute(id: string, input: Partial<AttributeInput>, metadata: CatalogActionMetadata): Promise<CatalogAttribute> {
    await this.requireAttribute(id);
    const normalized = normalizePartialAttributeInput(input);
    requireChanges(normalized);
    const attribute = await this.repository.updateAttribute(id, normalized);
    await this.audit(metadata, "catalog.attribute.updated", "CatalogAttribute", id, { slug: attribute.slug });
    return attribute;
  }

  async deleteAttribute(id: string, metadata: CatalogActionMetadata): Promise<void> {
    const attribute = await this.requireAttribute(id);
    if ((await this.repository.countVariantUsesByAttribute(id)) > 0) {
      throw new AppError({
        code: "CATALOG_ATTRIBUTE_IN_USE",
        message: "Attribute cannot be deleted while variants use it",
        statusCode: 409,
      });
    }
    await this.repository.deleteAttribute(id);
    await this.audit(metadata, "catalog.attribute.deleted", "CatalogAttribute", id, { slug: attribute.slug });
  }

  async createAttributeValue(attributeId: string, input: AttributeValueInput, metadata: CatalogActionMetadata): Promise<AttributeValue> {
    await this.requireAttribute(attributeId);
    const value = await this.repository.createAttributeValue(attributeId, normalizeAttributeValueInput(input));
    await this.audit(metadata, "catalog.attribute_value.created", "AttributeValue", value.id, { attributeId, slug: value.slug });
    return value;
  }

  async updateAttributeValue(id: string, input: Partial<AttributeValueInput>, metadata: CatalogActionMetadata): Promise<AttributeValue> {
    const existing = await this.requireAttributeValue(id);
    const normalized = normalizePartialAttributeValueInput(input);
    requireChanges(normalized);
    const value = await this.repository.updateAttributeValue(id, normalized);
    await this.audit(metadata, "catalog.attribute_value.updated", "AttributeValue", id, { attributeId: existing.attributeId, slug: value.slug });
    return value;
  }

  async deleteAttributeValue(id: string, metadata: CatalogActionMetadata): Promise<void> {
    const value = await this.requireAttributeValue(id);
    if ((await this.repository.countVariantUsesByAttributeValue(id)) > 0) {
      throw new AppError({
        code: "CATALOG_ATTRIBUTE_VALUE_IN_USE",
        message: "Attribute value cannot be deleted while variants use it",
        statusCode: 409,
      });
    }
    await this.repository.deleteAttributeValue(id);
    await this.audit(metadata, "catalog.attribute_value.deleted", "AttributeValue", id, { attributeId: value.attributeId, slug: value.slug });
  }

  async listProducts(input: ProductListInput): Promise<Page<Product>> {
    const result = await this.repository.listProducts(input);
    return { ...result, items: await this.enrichProducts(result.items) };
  }

  getProduct(id: string): Promise<Product> {
    return this.requireProduct(id);
  }

  async createProduct(input: ProductCreateInput, metadata: CatalogActionMetadata): Promise<Product> {
    const normalized = normalizeProductCreateInput(input);
    if (normalized.status === "ACTIVE") {
      throw new AppError({
        code: "CATALOG_ACTIVE_PRODUCT_REQUIRES_VARIANT",
        message: "Create the product as draft, add at least one active variant, then activate it",
        statusCode: 400,
      });
    }
    await this.validateProductReferences(normalized.brandId, normalized.categoryIds, normalized.mediaAssetIds);
    const schemaService = this.schemaService;
    const customFields = schemaService
      ? await schemaService.validateExtensionValues("catalog.product", normalized.customFields ?? {})
      : normalized.customFields;
    const product = await this.repository.createProduct(normalized);
    if (schemaService) {
      await schemaService.upsertExtension("catalog.product", "Product", product.id, customFields ?? {}, this.schemaAudit(metadata));
    }
    await this.audit(metadata, "catalog.product.created", "Product", product.id, { slug: product.slug, status: product.status });
    return this.enrichProduct(product);
  }

  async updateProduct(id: string, input: ProductUpdateInput, metadata: CatalogActionMetadata): Promise<Product> {
    const existing = await this.requireProduct(id);
    const normalized = normalizeProductUpdateInput(input);
    requireChanges(normalized);
    await this.validateProductReferences(
      normalized.brandId === undefined ? undefined : normalized.brandId,
      normalized.categoryIds,
      normalized.mediaAssetIds,
    );
    if (normalized.customFields !== undefined && this.schemaService) {
      await this.schemaService.validateExtensionValues("catalog.product", normalized.customFields);
    }
    if (normalized.status === "ACTIVE" && existing.status !== "ACTIVE") {
      if ((await this.repository.countActiveVariants(id)) < 1) {
        throw new AppError({
          code: "CATALOG_ACTIVE_PRODUCT_REQUIRES_VARIANT",
          message: "An active product requires at least one active variant",
          statusCode: 400,
        });
      }
    }
    const product = await this.repository.updateProduct(id, normalized);
    if (normalized.customFields !== undefined && this.schemaService) {
      await this.schemaService.upsertExtension("catalog.product", "Product", id, normalized.customFields, this.schemaAudit(metadata));
    }
    await this.audit(metadata, "catalog.product.updated", "Product", id, { slug: product.slug, status: product.status });
    return this.enrichProduct(product);
  }

  async deleteProduct(id: string, metadata: CatalogActionMetadata): Promise<void> {
    const product = await this.requireProduct(id);
    await this.repository.deleteProduct(id);
    const schemaService = this.schemaService;
    if (schemaService) {
      await Promise.all([
        schemaService.deleteExtension("catalog.product", "Product", id),
        ...product.variants.map((variant) => schemaService.deleteExtension("catalog.variant", "ProductVariant", variant.id)),
      ]);
    }
    await this.audit(metadata, "catalog.product.deleted", "Product", id, { slug: product.slug });
  }

  async createVariant(productId: string, input: Omit<VariantCreateInput, "productId">, metadata: CatalogActionMetadata): Promise<ProductVariant> {
    await this.requireProduct(productId);
    const normalized: VariantCreateInput = {
      productId,
      title: normalizeRequiredText(input.title, 160, "title"),
      sku: normalizeSku(input.sku),
      status: input.status,
      position: normalizePosition(input.position),
      attributeValueIds: uniqueIds(input.attributeValueIds),
      ...(input.customFields === undefined ? {} : { customFields: input.customFields }),
    };
    const selections = await this.resolveVariantSelections(normalized.attributeValueIds);
    const schemaService = this.schemaService;
    const customFields = schemaService
      ? await schemaService.validateExtensionValues("catalog.variant", normalized.customFields ?? {})
      : normalized.customFields;
    const variant = await this.repository.createVariant(normalized, selections);
    if (schemaService) {
      await schemaService.upsertExtension("catalog.variant", "ProductVariant", variant.id, customFields ?? {}, this.schemaAudit(metadata));
    }
    await this.audit(metadata, "catalog.variant.created", "ProductVariant", variant.id, { productId, sku: variant.sku });
    return this.enrichVariant(variant);
  }

  async updateVariant(id: string, input: VariantUpdateInput, metadata: CatalogActionMetadata): Promise<ProductVariant> {
    const existing = await this.requireVariant(id);
    const normalized = normalizeVariantUpdateInput(input);
    requireChanges(normalized);
    if (existing.status === "ACTIVE" && normalized.status === "DISABLED") {
      const product = await this.requireProduct(existing.productId);
      if (product.status === "ACTIVE" && (await this.repository.countActiveVariants(existing.productId, id)) < 1) {
        throw new AppError({
          code: "CATALOG_ACTIVE_PRODUCT_REQUIRES_VARIANT",
          message: "Cannot disable the last active variant of an active product",
          statusCode: 409,
        });
      }
    }
    if (normalized.customFields !== undefined && this.schemaService) {
      await this.schemaService.validateExtensionValues("catalog.variant", normalized.customFields);
    }
    const selections = normalized.attributeValueIds === undefined
      ? undefined
      : await this.resolveVariantSelections(normalized.attributeValueIds);
    const variant = await this.repository.updateVariant(id, normalized, selections);
    if (normalized.customFields !== undefined && this.schemaService) {
      await this.schemaService.upsertExtension("catalog.variant", "ProductVariant", id, normalized.customFields, this.schemaAudit(metadata));
    }
    await this.audit(metadata, "catalog.variant.updated", "ProductVariant", id, { productId: variant.productId, sku: variant.sku });
    return this.enrichVariant(variant);
  }

  async deleteVariant(id: string, metadata: CatalogActionMetadata): Promise<void> {
    const variant = await this.requireVariant(id);
    const product = await this.requireProduct(variant.productId);
    if (product.status === "ACTIVE" && variant.status === "ACTIVE" && (await this.repository.countActiveVariants(product.id, id)) < 1) {
      throw new AppError({
        code: "CATALOG_ACTIVE_PRODUCT_REQUIRES_VARIANT",
        message: "Cannot delete the last active variant of an active product",
        statusCode: 409,
      });
    }
    await this.repository.deleteVariant(id);
    if (this.schemaService) await this.schemaService.deleteExtension("catalog.variant", "ProductVariant", id);
    await this.audit(metadata, "catalog.variant.deleted", "ProductVariant", id, { productId: variant.productId, sku: variant.sku });
  }

  async listPublicProducts(input: PublicProductListInput): Promise<Page<Product>> {
    const result = await this.repository.listPublicProducts(input);
    return { ...result, items: await this.enrichProducts(result.items) };
  }

  async getPublicProductBySlug(slug: string): Promise<Product> {
    const product = await this.repository.getPublicProductBySlug(normalizeSlug(slug));
    if (!product) {
      throw new AppError({ code: "CATALOG_PUBLIC_PRODUCT_NOT_FOUND", message: "Product was not found", statusCode: 404 });
    }
    return this.enrichProduct(product);
  }

  private async enrichProduct(product: Product): Promise<Product> {
    return (await this.enrichProducts([product]))[0] ?? product;
  }

  private async enrichVariant(variant: ProductVariant): Promise<ProductVariant> {
    if (!this.schemaService) return variant;
    return {
      ...variant,
      customFields: await this.schemaService.getExtensionValues("catalog.variant", "ProductVariant", variant.id),
    };
  }

  private async enrichProducts(products: Product[]): Promise<Product[]> {
    if (!this.schemaService || products.length === 0) return products;
    const productExtensions = await this.schemaService.listExtensionValues("catalog.product", "Product", products.map((product) => product.id));
    const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));
    const variantExtensions = await this.schemaService.listExtensionValues("catalog.variant", "ProductVariant", variantIds);
    return products.map((product) => ({
      ...product,
      customFields: productExtensions.get(product.id) ?? {},
      variants: product.variants.map((variant) => ({ ...variant, customFields: variantExtensions.get(variant.id) ?? {} })),
    }));
  }

  private schemaAudit(metadata: CatalogActionMetadata) {
    return {
      actorUserId: metadata.actorId,
      ...(metadata.requestId === undefined ? {} : { requestId: metadata.requestId }),
      ...(metadata.ipAddress === undefined ? {} : { ipAddress: metadata.ipAddress }),
      ...(metadata.userAgent === undefined ? {} : { userAgent: metadata.userAgent }),
    };
  }

  private async resolveVariantSelections(attributeValueIds: readonly string[]): Promise<Array<{ attributeId: string; attributeValueId: string }>> {
    if (attributeValueIds.length === 0) return [];
    const values = await this.repository.getAttributeValues(attributeValueIds);
    if (values.length !== attributeValueIds.length) {
      throw new AppError({
        code: "CATALOG_ATTRIBUTE_VALUE_NOT_FOUND",
        message: "One or more selected attribute values do not exist",
        statusCode: 400,
      });
    }
    const attributes = new Set<string>();
    const selections: Array<{ attributeId: string; attributeValueId: string }> = [];
    for (const value of values) {
      if (attributes.has(value.attributeId)) {
        throw new AppError({
          code: "CATALOG_DUPLICATE_VARIANT_ATTRIBUTE",
          message: "A variant can select only one value from each attribute",
          statusCode: 400,
        });
      }
      attributes.add(value.attributeId);
      selections.push({ attributeId: value.attributeId, attributeValueId: value.id });
    }
    return selections;
  }

  private async validateProductReferences(
    brandId: string | null | undefined,
    categoryIds: readonly string[] | undefined,
    mediaAssetIds: readonly string[] | undefined,
  ): Promise<void> {
    if (brandId && !(await this.repository.brandExists(brandId))) {
      throw new AppError({ code: "CATALOG_BRAND_NOT_FOUND", message: "Brand was not found", statusCode: 400 });
    }
    if (categoryIds && !(await this.repository.categoriesExist(categoryIds))) {
      throw new AppError({ code: "CATALOG_CATEGORY_NOT_FOUND", message: "One or more categories were not found", statusCode: 400 });
    }
    if (mediaAssetIds && !(await this.repository.imageMediaExist(mediaAssetIds))) {
      throw new AppError({
        code: "CATALOG_MEDIA_INVALID",
        message: "Product media must reference existing image assets",
        statusCode: 400,
      });
    }
  }

  private async assertCategoryParentIsSafe(categoryId: string, parentId: string): Promise<void> {
    let cursor: string | null = parentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === categoryId) {
        throw new AppError({ code: "CATALOG_CATEGORY_CYCLE", message: "Category hierarchy cannot contain a cycle", statusCode: 400 });
      }
      if (visited.has(cursor)) {
        throw new AppError({ code: "CATALOG_CATEGORY_CYCLE", message: "Category hierarchy already contains a cycle", statusCode: 409 });
      }
      visited.add(cursor);
      const parent = await this.requireCategory(cursor);
      cursor = parent.parentId;
    }
  }

  private async requireBrand(id: string): Promise<Brand> {
    const brand = await this.repository.getBrand(id);
    if (!brand) throw new AppError({ code: "CATALOG_BRAND_NOT_FOUND", message: "Brand was not found", statusCode: 404 });
    return brand;
  }

  private async requireCategory(id: string): Promise<Category> {
    const category = await this.repository.getCategory(id);
    if (!category) throw new AppError({ code: "CATALOG_CATEGORY_NOT_FOUND", message: "Category was not found", statusCode: 404 });
    return category;
  }

  private async requireAttribute(id: string): Promise<CatalogAttribute> {
    const attribute = await this.repository.getAttribute(id);
    if (!attribute) throw new AppError({ code: "CATALOG_ATTRIBUTE_NOT_FOUND", message: "Attribute was not found", statusCode: 404 });
    return attribute;
  }

  private async requireAttributeValue(id: string): Promise<AttributeValue> {
    const value = await this.repository.getAttributeValue(id);
    if (!value) throw new AppError({ code: "CATALOG_ATTRIBUTE_VALUE_NOT_FOUND", message: "Attribute value was not found", statusCode: 404 });
    return value;
  }

  private async requireProduct(id: string): Promise<Product> {
    const product = await this.repository.getProduct(id);
    if (!product) throw new AppError({ code: "CATALOG_PRODUCT_NOT_FOUND", message: "Product was not found", statusCode: 404 });
    return this.enrichProduct(product);
  }

  private async requireVariant(id: string): Promise<ProductVariant> {
    const variant = await this.repository.getVariant(id);
    if (!variant) throw new AppError({ code: "CATALOG_VARIANT_NOT_FOUND", message: "Product variant was not found", statusCode: 404 });
    return this.enrichVariant(variant);
  }

  private audit(metadata: CatalogActionMetadata, action: string, targetType: string, targetId: string | null, details?: Record<string, unknown>): Promise<void> {
    return this.repository.audit({
      actorUserId: metadata.actorId,
      action,
      targetType,
      targetId,
      ...(metadata.requestId === undefined ? {} : { requestId: metadata.requestId }),
      ...(metadata.ipAddress === undefined ? {} : { ipAddress: metadata.ipAddress }),
      ...(metadata.userAgent === undefined ? {} : { userAgent: metadata.userAgent }),
      ...(details === undefined ? {} : { metadata: details }),
    });
  }
}

function normalizeBrandInput(input: BrandInput): BrandInput {
  return {
    name: normalizeRequiredText(input.name, 120, "name"),
    slug: normalizeSlug(input.slug),
    ...(input.description === undefined ? {} : { description: normalizeOptionalText(input.description, 1000) }),
  };
}

function normalizePartialBrandInput(input: Partial<BrandInput>): Partial<BrandInput> {
  return {
    ...(input.name === undefined ? {} : { name: normalizeRequiredText(input.name, 120, "name") }),
    ...(input.slug === undefined ? {} : { slug: normalizeSlug(input.slug) }),
    ...(input.description === undefined ? {} : { description: normalizeOptionalText(input.description, 1000) }),
  };
}

function normalizeCategoryInput(input: CategoryInput): CategoryInput {
  return {
    name: normalizeRequiredText(input.name, 120, "name"),
    slug: normalizeSlug(input.slug),
    ...(input.description === undefined ? {} : { description: normalizeOptionalText(input.description, 1000) }),
    ...(input.parentId === undefined ? {} : { parentId: normalizeOptionalId(input.parentId) }),
    position: normalizePosition(input.position),
  };
}

function normalizePartialCategoryInput(input: Partial<CategoryInput>): Partial<CategoryInput> {
  return {
    ...(input.name === undefined ? {} : { name: normalizeRequiredText(input.name, 120, "name") }),
    ...(input.slug === undefined ? {} : { slug: normalizeSlug(input.slug) }),
    ...(input.description === undefined ? {} : { description: normalizeOptionalText(input.description, 1000) }),
    ...(input.parentId === undefined ? {} : { parentId: normalizeOptionalId(input.parentId) }),
    ...(input.position === undefined ? {} : { position: normalizePosition(input.position) }),
  };
}

function normalizeAttributeInput(input: AttributeInput): AttributeInput {
  return { name: normalizeRequiredText(input.name, 120, "name"), slug: normalizeSlug(input.slug), position: normalizePosition(input.position) };
}

function normalizePartialAttributeInput(input: Partial<AttributeInput>): Partial<AttributeInput> {
  return {
    ...(input.name === undefined ? {} : { name: normalizeRequiredText(input.name, 120, "name") }),
    ...(input.slug === undefined ? {} : { slug: normalizeSlug(input.slug) }),
    ...(input.position === undefined ? {} : { position: normalizePosition(input.position) }),
  };
}

function normalizeAttributeValueInput(input: AttributeValueInput): AttributeValueInput {
  return { value: normalizeRequiredText(input.value, 120, "value"), slug: normalizeSlug(input.slug), position: normalizePosition(input.position) };
}

function normalizePartialAttributeValueInput(input: Partial<AttributeValueInput>): Partial<AttributeValueInput> {
  return {
    ...(input.value === undefined ? {} : { value: normalizeRequiredText(input.value, 120, "value") }),
    ...(input.slug === undefined ? {} : { slug: normalizeSlug(input.slug) }),
    ...(input.position === undefined ? {} : { position: normalizePosition(input.position) }),
  };
}

function normalizeProductCreateInput(input: ProductCreateInput): ProductCreateInput {
  return {
    name: normalizeRequiredText(input.name, 180, "name"),
    slug: normalizeSlug(input.slug),
    ...(input.description === undefined ? {} : { description: normalizeOptionalText(input.description, 10_000) }),
    status: input.status,
    ...(input.brandId === undefined ? {} : { brandId: normalizeOptionalId(input.brandId) }),
    categoryIds: uniqueIds(input.categoryIds),
    mediaAssetIds: uniqueIds(input.mediaAssetIds),
    ...(input.customFields === undefined ? {} : { customFields: input.customFields }),
  };
}

function normalizeProductUpdateInput(input: ProductUpdateInput): ProductUpdateInput {
  return {
    ...(input.name === undefined ? {} : { name: normalizeRequiredText(input.name, 180, "name") }),
    ...(input.slug === undefined ? {} : { slug: normalizeSlug(input.slug) }),
    ...(input.description === undefined ? {} : { description: normalizeOptionalText(input.description, 10_000) }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.brandId === undefined ? {} : { brandId: normalizeOptionalId(input.brandId) }),
    ...(input.categoryIds === undefined ? {} : { categoryIds: uniqueIds(input.categoryIds) }),
    ...(input.mediaAssetIds === undefined ? {} : { mediaAssetIds: uniqueIds(input.mediaAssetIds) }),
    ...(input.customFields === undefined ? {} : { customFields: input.customFields }),
  };
}

function normalizeVariantUpdateInput(input: VariantUpdateInput): VariantUpdateInput {
  return {
    ...(input.title === undefined ? {} : { title: normalizeRequiredText(input.title, 160, "title") }),
    ...(input.sku === undefined ? {} : { sku: normalizeSku(input.sku) }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.position === undefined ? {} : { position: normalizePosition(input.position) }),
    ...(input.attributeValueIds === undefined ? {} : { attributeValueIds: uniqueIds(input.attributeValueIds) }),
    ...(input.customFields === undefined ? {} : { customFields: input.customFields }),
  };
}

function normalizeRequiredText(value: string, maxLength: number, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AppError({ code: "CATALOG_INVALID_TEXT", message: `${field} is required`, statusCode: 400 });
  }
  if (normalized.length > maxLength) {
    throw new AppError({ code: "CATALOG_INVALID_TEXT", message: `${field} is too long`, statusCode: 400 });
  }
  return normalized;
}

function normalizeOptionalText(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new AppError({ code: "CATALOG_INVALID_TEXT", message: "Text value is too long", statusCode: 400 });
  }
  return normalized;
}

function normalizeSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(normalized) || normalized.length > 160) {
    throw new AppError({
      code: "CATALOG_INVALID_SLUG",
      message: "Slug must contain letters, numbers and single hyphens",
      statusCode: 400,
    });
  }
  return normalized;
}

function normalizeSku(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(normalized)) {
    throw new AppError({
      code: "CATALOG_INVALID_SKU",
      message: "SKU must contain only letters, numbers, dots, underscores and hyphens",
      statusCode: 400,
    });
  }
  return normalized;
}

function normalizePosition(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new AppError({ code: "CATALOG_INVALID_POSITION", message: "Position must be a non-negative integer", statusCode: 400 });
  }
  return value;
}

function normalizeOptionalId(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized || null;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function requireChanges(value: object): void {
  if (Object.keys(value).length === 0) {
    throw new AppError({ code: "CATALOG_NO_CHANGES", message: "At least one field is required", statusCode: 400 });
  }
}

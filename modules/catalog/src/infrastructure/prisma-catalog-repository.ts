import { AppError } from "@beyondx/core";
import { Prisma, type PrismaClient } from "@beyondx/database";
import type {
  AttributeInput,
  AttributeValueInput,
  BrandInput,
  CatalogAuditInput,
  CatalogRepository,
  CategoryInput,
  ProductCreateInput,
  ProductUpdateInput,
  VariantCreateInput,
  VariantUpdateInput,
} from "../application/contracts.js";
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

const attributeInclude = {
  values: { orderBy: [{ position: "asc" as const }, { value: "asc" as const }] },
} satisfies Prisma.CatalogAttributeInclude;

const variantAttributeInclude = {
  attribute: { select: { id: true, name: true, slug: true } },
  attributeValue: { select: { id: true, value: true, slug: true } },
} satisfies Prisma.VariantAttributeValueInclude;

const adminProductInclude = {
  brand: true,
  categories: {
    orderBy: { position: "asc" as const },
    include: { category: true },
  },
  media: {
    orderBy: { position: "asc" as const },
    include: { mediaAsset: true },
  },
  variants: {
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      attributeValues: {
        orderBy: { attributeId: "asc" as const },
        include: variantAttributeInclude,
      },
    },
  },
} satisfies Prisma.ProductInclude;

const publicProductInclude = {
  ...adminProductInclude,
  variants: {
    where: { status: "ACTIVE" as const },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      attributeValues: {
        orderBy: { attributeId: "asc" as const },
        include: variantAttributeInclude,
      },
    },
  },
} satisfies Prisma.ProductInclude;

interface ProductRecordShape {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  brandId: string | null;
  createdAt: Date;
  updatedAt: Date;
  brand: BrandRecord | null;
  categories: Array<{ position: number; category: CategoryRecord }>;
  media: Array<{
    position: number;
    mediaAsset: {
      id: string;
      originalName: string;
      mimeType: string;
      width: number | null;
      height: number | null;
      altText: string | null;
      title: string | null;
    };
  }>;
  variants: VariantRecordShape[];
}

interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

interface VariantRecordShape {
  id: string;
  productId: string;
  title: string;
  sku: string;
  status: "ACTIVE" | "DISABLED";
  position: number;
  createdAt: Date;
  updatedAt: Date;
  attributeValues: Array<{
    attributeId: string;
    attributeValueId: string;
    attribute: { id: string; name: string; slug: string };
    attributeValue: { id: string; value: string; slug: string };
  }>;
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly database: PrismaClient) {}

  async listBrands(): Promise<Brand[]> {
    return (await this.database.brand.findMany({ orderBy: [{ name: "asc" }, { createdAt: "asc" }] })).map(mapBrand);
  }

  async getBrand(id: string): Promise<Brand | null> {
    const record = await this.database.brand.findUnique({ where: { id } });
    return record ? mapBrand(record) : null;
  }

  async createBrand(input: BrandInput): Promise<Brand> {
    try {
      return mapBrand(await this.database.brand.create({ data: input }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateBrand(id: string, input: Partial<BrandInput>): Promise<Brand> {
    try {
      return mapBrand(await this.database.brand.update({ where: { id }, data: input }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async deleteBrand(id: string): Promise<void> {
    try {
      await this.database.brand.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  countProductsByBrand(id: string): Promise<number> {
    return this.database.product.count({ where: { brandId: id } });
  }

  async listCategories(): Promise<Category[]> {
    return (await this.database.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] })).map(mapCategory);
  }

  async getCategory(id: string): Promise<Category | null> {
    const record = await this.database.category.findUnique({ where: { id } });
    return record ? mapCategory(record) : null;
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    try {
      return mapCategory(await this.database.category.create({ data: input }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateCategory(id: string, input: Partial<CategoryInput>): Promise<Category> {
    try {
      return mapCategory(await this.database.category.update({ where: { id }, data: input }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      await this.database.category.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  countProductsByCategory(id: string): Promise<number> {
    return this.database.productCategory.count({ where: { categoryId: id } });
  }

  async listAttributes(): Promise<CatalogAttribute[]> {
    const records = await this.database.catalogAttribute.findMany({
      include: attributeInclude,
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    return records.map(mapAttribute);
  }

  async getAttribute(id: string): Promise<CatalogAttribute | null> {
    const record = await this.database.catalogAttribute.findUnique({ where: { id }, include: attributeInclude });
    return record ? mapAttribute(record) : null;
  }

  async createAttribute(input: AttributeInput): Promise<CatalogAttribute> {
    try {
      const record = await this.database.catalogAttribute.create({ data: input, include: attributeInclude });
      return mapAttribute(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateAttribute(id: string, input: Partial<AttributeInput>): Promise<CatalogAttribute> {
    try {
      const record = await this.database.catalogAttribute.update({ where: { id }, data: input, include: attributeInclude });
      return mapAttribute(record);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async deleteAttribute(id: string): Promise<void> {
    try {
      await this.database.catalogAttribute.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  countVariantUsesByAttribute(id: string): Promise<number> {
    return this.database.variantAttributeValue.count({ where: { attributeId: id } });
  }

  async createAttributeValue(attributeId: string, input: AttributeValueInput): Promise<AttributeValue> {
    try {
      return mapAttributeValue(await this.database.attributeValue.create({ data: { attributeId, ...input } }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateAttributeValue(id: string, input: Partial<AttributeValueInput>): Promise<AttributeValue> {
    try {
      return mapAttributeValue(await this.database.attributeValue.update({ where: { id }, data: input }));
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async deleteAttributeValue(id: string): Promise<void> {
    try {
      await this.database.attributeValue.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async getAttributeValue(id: string): Promise<AttributeValue | null> {
    const record = await this.database.attributeValue.findUnique({ where: { id } });
    return record ? mapAttributeValue(record) : null;
  }

  async getAttributeValues(ids: readonly string[]): Promise<AttributeValue[]> {
    if (ids.length === 0) return [];
    return (await this.database.attributeValue.findMany({ where: { id: { in: [...ids] } } })).map(mapAttributeValue);
  }

  countVariantUsesByAttributeValue(id: string): Promise<number> {
    return this.database.variantAttributeValue.count({ where: { attributeValueId: id } });
  }

  async listProducts(input: ProductListInput): Promise<Page<Product>> {
    const where: Prisma.ProductWhereInput = {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.brandId === undefined ? {} : { brandId: input.brandId }),
      ...(input.categoryId === undefined ? {} : { categories: { some: { categoryId: input.categoryId } } }),
      ...(input.search === undefined || input.search.length === 0
        ? {}
        : {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { slug: { contains: input.search, mode: "insensitive" } },
              { variants: { some: { sku: { contains: input.search, mode: "insensitive" } } } },
            ],
          }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.product.findMany({
        where,
        include: adminProductInclude,
        orderBy: { updatedAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.product.count({ where }),
    ]);
    return page(items.map(mapProduct), input.page, input.pageSize, total);
  }

  async listPublicProducts(input: PublicProductListInput): Promise<Page<Product>> {
    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
      ...(input.brand === undefined ? {} : { brand: { slug: input.brand } }),
      ...(input.category === undefined ? {} : { categories: { some: { category: { slug: input.category } } } }),
      ...(input.search === undefined || input.search.length === 0
        ? {}
        : {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { slug: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
            ],
          }),
    };
    const [items, total] = await this.database.$transaction([
      this.database.product.findMany({
        where,
        include: publicProductInclude,
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.product.count({ where }),
    ]);
    return page(items.map(mapProduct), input.page, input.pageSize, total);
  }

  async getProduct(id: string): Promise<Product | null> {
    const record = await this.database.product.findUnique({ where: { id }, include: adminProductInclude });
    return record ? mapProduct(record) : null;
  }

  async getPublicProductBySlug(slug: string): Promise<Product | null> {
    const record = await this.database.product.findFirst({ where: { slug, status: "ACTIVE" }, include: publicProductInclude });
    return record ? mapProduct(record) : null;
  }

  async createProduct(input: ProductCreateInput): Promise<Product> {
    try {
      const id = await this.database.$transaction(async (transaction) => {
        const product = await transaction.product.create({
          data: {
            name: input.name,
            slug: input.slug,
            ...(input.description === undefined ? {} : { description: input.description }),
            status: input.status,
            ...(input.brandId === undefined ? {} : { brandId: input.brandId }),
          },
        });
        if (input.categoryIds.length > 0) {
          await transaction.productCategory.createMany({
            data: input.categoryIds.map((categoryId, position) => ({ productId: product.id, categoryId, position })),
          });
        }
        if (input.mediaAssetIds.length > 0) {
          await transaction.productMedia.createMany({
            data: input.mediaAssetIds.map((mediaAssetId, position) => ({ productId: product.id, mediaAssetId, position })),
          });
        }
        return product.id;
      });
      return await this.requireProductAfterWrite(id);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateProduct(id: string, input: ProductUpdateInput): Promise<Product> {
    try {
      await this.database.$transaction(async (transaction) => {
        await transaction.product.update({
          where: { id },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.slug === undefined ? {} : { slug: input.slug }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.brandId === undefined ? {} : { brandId: input.brandId }),
          },
        });
        if (input.categoryIds !== undefined) {
          await transaction.productCategory.deleteMany({ where: { productId: id } });
          if (input.categoryIds.length > 0) {
            await transaction.productCategory.createMany({
              data: input.categoryIds.map((categoryId, position) => ({ productId: id, categoryId, position })),
            });
          }
        }
        if (input.mediaAssetIds !== undefined) {
          await transaction.productMedia.deleteMany({ where: { productId: id } });
          if (input.mediaAssetIds.length > 0) {
            await transaction.productMedia.createMany({
              data: input.mediaAssetIds.map((mediaAssetId, position) => ({ productId: id, mediaAssetId, position })),
            });
          }
        }
      });
      return await this.requireProductAfterWrite(id);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      await this.database.product.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async categoriesExist(ids: readonly string[]): Promise<boolean> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return true;
    return (await this.database.category.count({ where: { id: { in: unique } } })) === unique.length;
  }

  async imageMediaExist(ids: readonly string[]): Promise<boolean> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return true;
    return (await this.database.mediaAsset.count({ where: { id: { in: unique }, kind: "IMAGE" } })) === unique.length;
  }

  async brandExists(id: string): Promise<boolean> {
    return (await this.database.brand.count({ where: { id } })) === 1;
  }

  async getVariant(id: string): Promise<ProductVariant | null> {
    const record = await this.database.productVariant.findUnique({
      where: { id },
      include: { attributeValues: { orderBy: { attributeId: "asc" }, include: variantAttributeInclude } },
    });
    return record ? mapVariant(record) : null;
  }

  async createVariant(
    input: VariantCreateInput,
    selections: Array<{ attributeId: string; attributeValueId: string }>,
  ): Promise<ProductVariant> {
    try {
      const id = await this.database.$transaction(async (transaction) => {
        const variant = await transaction.productVariant.create({
          data: {
            productId: input.productId,
            title: input.title,
            sku: input.sku,
            status: input.status,
            position: input.position,
          },
        });
        if (selections.length > 0) {
          await transaction.variantAttributeValue.createMany({
            data: selections.map((selection) => ({ variantId: variant.id, ...selection })),
          });
        }
        return variant.id;
      });
      return await this.requireVariantAfterWrite(id);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateVariant(
    id: string,
    input: VariantUpdateInput,
    selections?: Array<{ attributeId: string; attributeValueId: string }>,
  ): Promise<ProductVariant> {
    try {
      await this.database.$transaction(async (transaction) => {
        await transaction.productVariant.update({
          where: { id },
          data: {
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.sku === undefined ? {} : { sku: input.sku }),
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.position === undefined ? {} : { position: input.position }),
          },
        });
        if (selections !== undefined) {
          await transaction.variantAttributeValue.deleteMany({ where: { variantId: id } });
          if (selections.length > 0) {
            await transaction.variantAttributeValue.createMany({
              data: selections.map((selection) => ({ variantId: id, ...selection })),
            });
          }
        }
      });
      return await this.requireVariantAfterWrite(id);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async deleteVariant(id: string): Promise<void> {
    try {
      await this.database.productVariant.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  countActiveVariants(productId: string, excludeVariantId?: string): Promise<number> {
    return this.database.productVariant.count({
      where: {
        productId,
        status: "ACTIVE",
        ...(excludeVariantId === undefined ? {} : { id: { not: excludeVariantId } }),
      },
    });
  }

  async audit(input: CatalogAuditInput): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        ...(input.metadata === undefined ? {} : { metadata: input.metadata as Prisma.InputJsonValue }),
      },
    });
  }

  private async requireProductAfterWrite(id: string): Promise<Product> {
    const product = await this.getProduct(id);
    if (!product) throw new Error("Catalog product disappeared after write");
    return product;
  }

  private async requireVariantAfterWrite(id: string): Promise<ProductVariant> {
    const variant = await this.getVariant(id);
    if (!variant) throw new Error("Catalog variant disappeared after write");
    return variant;
  }
}

function mapBrand(record: BrandRecord): Brand {
  return { ...record };
}

function mapCategory(record: CategoryRecord): Category {
  return { ...record };
}

function mapAttributeValue(record: {
  id: string;
  attributeId: string;
  value: string;
  slug: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}): AttributeValue {
  return { ...record };
}

function mapAttribute(record: Prisma.CatalogAttributeGetPayload<{ include: typeof attributeInclude }>): CatalogAttribute {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    position: record.position,
    values: record.values.map(mapAttributeValue),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapVariant(record: VariantRecordShape): ProductVariant {
  return {
    id: record.id,
    productId: record.productId,
    title: record.title,
    sku: record.sku,
    status: record.status,
    position: record.position,
    attributes: record.attributeValues.map((selection) => ({
      attributeId: selection.attribute.id,
      attributeName: selection.attribute.name,
      attributeSlug: selection.attribute.slug,
      valueId: selection.attributeValue.id,
      value: selection.attributeValue.value,
      valueSlug: selection.attributeValue.slug,
    })),
    customFields: {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapProduct(record: ProductRecordShape): Product {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    status: record.status,
    brandId: record.brandId,
    brand: record.brand ? mapBrand(record.brand) : null,
    categories: record.categories.map((item) => mapCategory(item.category)),
    media: record.media.map((item) => ({
      id: item.mediaAsset.id,
      originalName: item.mediaAsset.originalName,
      mimeType: item.mediaAsset.mimeType,
      width: item.mediaAsset.width,
      height: item.mediaAsset.height,
      altText: item.mediaAsset.altText,
      title: item.mediaAsset.title,
      position: item.position,
    })),
    variants: record.variants.map(mapVariant),
    customFields: {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function page<T>(items: T[], pageNumber: number, pageSize: number, total: number): Page<T> {
  return {
    items,
    page: pageNumber,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function mapPrismaError(error: unknown): Error {
  if (error instanceof AppError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new AppError({
        code: "CATALOG_UNIQUE_CONFLICT",
        message: "A catalog record with the same unique value already exists",
        statusCode: 409,
        details: { target: Array.isArray(error.meta?.target) ? error.meta.target : error.meta?.target ?? null },
      });
    }
    if (error.code === "P2003") {
      return new AppError({
        code: "CATALOG_REFERENCE_CONFLICT",
        message: "Catalog record is still referenced by another record",
        statusCode: 409,
      });
    }
    if (error.code === "P2025") {
      return new AppError({ code: "CATALOG_RECORD_NOT_FOUND", message: "Catalog record was not found", statusCode: 404 });
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

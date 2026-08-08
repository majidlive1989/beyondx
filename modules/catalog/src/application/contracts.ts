import type {
  AttributeValue,
  Brand,
  CatalogAttribute,
  Category,
  Page,
  Product,
  ProductListInput,
  ProductStatus,
  ProductVariant,
  ProductVariantStatus,
  PublicProductListInput,
} from "../domain/models.js";

export interface BrandInput {
  name: string;
  slug: string;
  description?: string | null;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  position: number;
}

export interface AttributeInput {
  name: string;
  slug: string;
  position: number;
}

export interface AttributeValueInput {
  value: string;
  slug: string;
  position: number;
}

export interface ProductCreateInput {
  name: string;
  slug: string;
  description?: string | null;
  status: ProductStatus;
  brandId?: string | null;
  categoryIds: string[];
  mediaAssetIds: string[];
  customFields?: Record<string, unknown>;
}

export interface ProductUpdateInput {
  name?: string;
  slug?: string;
  description?: string | null;
  status?: ProductStatus;
  brandId?: string | null;
  categoryIds?: string[];
  mediaAssetIds?: string[];
  customFields?: Record<string, unknown>;
}

export interface VariantCreateInput {
  productId: string;
  title: string;
  sku: string;
  status: ProductVariantStatus;
  position: number;
  attributeValueIds: string[];
  customFields?: Record<string, unknown>;
}

export interface VariantUpdateInput {
  title?: string;
  sku?: string;
  status?: ProductVariantStatus;
  position?: number;
  attributeValueIds?: string[];
  customFields?: Record<string, unknown>;
}

export interface CatalogAuditInput {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface CatalogRepository {
  listBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | null>;
  createBrand(input: BrandInput): Promise<Brand>;
  updateBrand(id: string, input: Partial<BrandInput>): Promise<Brand>;
  deleteBrand(id: string): Promise<void>;
  countProductsByBrand(id: string): Promise<number>;

  listCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | null>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: Partial<CategoryInput>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  countProductsByCategory(id: string): Promise<number>;

  listAttributes(): Promise<CatalogAttribute[]>;
  getAttribute(id: string): Promise<CatalogAttribute | null>;
  createAttribute(input: AttributeInput): Promise<CatalogAttribute>;
  updateAttribute(id: string, input: Partial<AttributeInput>): Promise<CatalogAttribute>;
  deleteAttribute(id: string): Promise<void>;
  countVariantUsesByAttribute(id: string): Promise<number>;
  createAttributeValue(attributeId: string, input: AttributeValueInput): Promise<AttributeValue>;
  updateAttributeValue(id: string, input: Partial<AttributeValueInput>): Promise<AttributeValue>;
  deleteAttributeValue(id: string): Promise<void>;
  getAttributeValue(id: string): Promise<AttributeValue | null>;
  getAttributeValues(ids: readonly string[]): Promise<AttributeValue[]>;
  countVariantUsesByAttributeValue(id: string): Promise<number>;

  listProducts(input: ProductListInput): Promise<Page<Product>>;
  listPublicProducts(input: PublicProductListInput): Promise<Page<Product>>;
  getProduct(id: string): Promise<Product | null>;
  getPublicProductBySlug(slug: string): Promise<Product | null>;
  createProduct(input: ProductCreateInput): Promise<Product>;
  updateProduct(id: string, input: ProductUpdateInput): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  categoriesExist(ids: readonly string[]): Promise<boolean>;
  imageMediaExist(ids: readonly string[]): Promise<boolean>;
  brandExists(id: string): Promise<boolean>;

  getVariant(id: string): Promise<ProductVariant | null>;
  createVariant(input: VariantCreateInput, selections: Array<{ attributeId: string; attributeValueId: string }>): Promise<ProductVariant>;
  updateVariant(id: string, input: VariantUpdateInput, selections?: Array<{ attributeId: string; attributeValueId: string }>): Promise<ProductVariant>;
  deleteVariant(id: string): Promise<void>;
  countActiveVariants(productId: string, excludeVariantId?: string): Promise<number>;

  audit(input: CatalogAuditInput): Promise<void>;
}

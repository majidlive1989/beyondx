export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type ProductVariantStatus = "ACTIVE" | "DISABLED";

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttributeValue {
  id: string;
  attributeId: string;
  value: string;
  slug: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogAttribute {
  id: string;
  name: string;
  slug: string;
  position: number;
  values: AttributeValue[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMedia {
  id: string;
  originalName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  title: string | null;
  position: number;
}

export interface VariantAttributeSelection {
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
  valueId: string;
  value: string;
  valueSlug: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  status: ProductVariantStatus;
  position: number;
  attributes: VariantAttributeSelection[];
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  brandId: string | null;
  brand: Brand | null;
  categories: Category[];
  media: ProductMedia[];
  variants: ProductVariant[];
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface ProductListInput {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProductStatus;
  brandId?: string;
  categoryId?: string;
}

export interface PublicProductListInput {
  page: number;
  pageSize: number;
  search?: string;
  brand?: string;
  category?: string;
}

export interface BeyondXPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface ThemeDeliveryManifest {
  platform: "BeyondX";
  apiVersion: "v1";
  sdkPackage: "@beyondx/theme-sdk";
  capabilities: {
    content: boolean;
    dynamicData: boolean;
    publicMedia: boolean;
    catalog: boolean;
    discussions: boolean;
    commerce: boolean;
  };
  endpoints: Record<string, string | null>;
}


export type MediaKind = "IMAGE" | "FILE";
export type MediaVisibility = "PUBLIC" | "PRIVATE";

export interface PublicMediaAsset {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  kind: MediaKind;
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  visibility: "PUBLIC";
  contentUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentRelation {
  fieldKey: string;
  targetEntryId: string;
}

export interface ContentEntry<TData extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  contentTypeId: string;
  contentTypeApiId: string;
  slug: string;
  locale: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  data: TData;
  seoTitle: string | null;
  seoDescription: string | null;
  seoMetadata: Record<string, unknown> | null;
  relations: ContentRelation[];
  scheduledPublishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicRecord<TValues extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  schemaId: string;
  schemaKey: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  values: TValues;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogMedia {
  id: string;
  originalName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  title: string | null;
  position: number;
}

export interface CatalogVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  status: "ACTIVE" | "DISABLED";
  position: number;
  attributes: Array<{
    attributeId: string;
    attributeName: string;
    attributeSlug: string;
    valueId: string;
    value: string;
    valueSlug: string;
  }>;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProduct<TCustomFields extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  brandId: string | null;
  brand: CatalogBrand | null;
  categories: CatalogCategory[];
  media: CatalogMedia[];
  variants: CatalogVariant[];
  customFields: TCustomFields;
  createdAt: string;
  updatedAt: string;
}

export type DiscussionSourceType = "CONTENT" | "PRODUCT";
export type DiscussionKind = "COMMENT" | "REVIEW";

export interface DiscussionEntry {
  id: string;
  sourceType: DiscussionSourceType;
  sourceId: string;
  kind: DiscussionKind;
  parentId: string | null;
  authorName: string;
  body: string;
  rating: number | null;
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  replies: DiscussionEntry[];
}

export interface DiscussionSettings {
  commentsEnabled: boolean;
  reviewsEnabled: boolean;
  ratingEnabled: boolean;
  verifiedPurchaseOnly: boolean;
  notifyOnNew: boolean;
}

export interface DiscussionThread {
  items: DiscussionEntry[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  settings: DiscussionSettings;
  rating: { average: number | null; count: number } | null;
}

export interface DiscussionSubmission {
  sourceType: DiscussionSourceType;
  sourceId: string;
  kind: DiscussionKind;
  authorName: string;
  authorEmail: string;
  body: string;
  parentId?: string;
  rating?: number;
}

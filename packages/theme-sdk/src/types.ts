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
    siteGlobals: boolean;
    corporateContent: boolean;
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

export type SiteSocialPlatform =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "LINKEDIN"
  | "X"
  | "YOUTUBE"
  | "TELEGRAM"
  | "WHATSAPP"
  | "TIKTOK"
  | "GITHUB"
  | "CUSTOM";

export interface SiteSocialLink {
  platform?: SiteSocialPlatform | null;
  label?: string | null;
  url: string;
  icon?: string | null;
  openInNewTab?: boolean;
}

export interface SiteSettingsValues extends Record<string, unknown> {
  siteName: string;
  tagline?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  logo?: string | null;
  favicon?: string | null;
  socialLinks?: SiteSocialLink[];
  footerText?: string | null;
  copyrightText?: string | null;
  defaultLocale?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImage?: string | null;
}


export interface CorporatePageValues extends Record<string, unknown> {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  featuredImage?: string | null;
  template?: "DEFAULT" | "FULL_WIDTH" | "LANDING" | null;
  sortOrder?: number | null;
  locale?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImage?: string | null;
  canonicalUrl?: string | null;
  noIndex?: boolean;
}

export interface BlogCategoryValues extends Record<string, unknown> {
  name: string;
  slug: string;
  description?: string | null;
}

export interface BlogTagValues extends Record<string, unknown> {
  name: string;
  slug: string;
}

export interface BlogPostValues extends Record<string, unknown> {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  featuredImage?: string | null;
  category?: string | null;
  tags?: string[];
  authorName?: string | null;
  publishedAt?: string | null;
  locale?: string | null;
  isFeatured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImage?: string | null;
  canonicalUrl?: string | null;
  noIndex?: boolean;
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

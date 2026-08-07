export type MediaKind = "IMAGE" | "FILE";

export interface MediaAsset {
  id: string;
  originalName: string;
  fileName: string;
  storageProvider: string;
  storageKey: string;
  mimeType: string;
  kind: MediaKind;
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaPage {
  items: MediaAsset[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface MediaListInput {
  page: number;
  pageSize: number;
  search?: string;
  kind?: MediaKind;
  mimeType?: string;
}

export interface MediaUpdateInput {
  title?: string | null;
  altText?: string | null;
  metadata?: Record<string, unknown> | null;
}

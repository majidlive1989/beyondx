import type {
  MediaAsset,
  MediaKind,
  MediaListInput,
  MediaPage,
  MediaUpdateInput,
} from "../domain/models.js";

export interface MediaCreateRecordInput {
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
}

export interface MediaRepository {
  create(input: MediaCreateRecordInput): Promise<MediaAsset>;
  findById(id: string): Promise<MediaAsset | null>;
  list(input: MediaListInput): Promise<MediaPage>;
  update(id: string, input: MediaUpdateInput): Promise<MediaAsset>;
  delete(id: string): Promise<void>;
  audit(input: {
    actorUserId: string | null;
    action: string;
    targetId: string | null;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface StorageWriteInput {
  key: string;
  data: Uint8Array;
}

export interface StorageAdapter {
  readonly provider: string;
  write(input: StorageWriteInput): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  health(): Promise<void>;
}

import { randomUUID } from "node:crypto";
import path from "node:path";
import { AppError } from "@beyondx/core";
import type {
  MediaRepository,
  StorageAdapter,
} from "./contracts.js";
import type {
  MediaAsset,
  MediaListInput,
  MediaPage,
  MediaUpdateInput,
} from "../domain/models.js";
import { inspectFile } from "../infrastructure/file-inspection.js";

export interface MediaRequestMetadata {
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UploadMediaInput {
  originalName: string;
  declaredMimeType: string;
  data: Uint8Array;
  title?: string | null;
  altText?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MediaContent {
  asset: MediaAsset;
  data: Uint8Array;
}

export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: StorageAdapter,
    private readonly options: {
      maxFileSizeBytes: number;
      allowedMimeTypes: ReadonlySet<string>;
    },
  ) {}

  async upload(
    input: UploadMediaInput,
    request: MediaRequestMetadata,
  ): Promise<MediaAsset> {
    if (input.data.byteLength === 0) {
      throw new AppError({
        code: "MEDIA_FILE_EMPTY",
        message: "Uploaded file is empty",
        statusCode: 400,
      });
    }
    if (input.data.byteLength > this.options.maxFileSizeBytes) {
      throw new AppError({
        code: "MEDIA_FILE_TOO_LARGE",
        message: "Uploaded file exceeds the configured size limit",
        statusCode: 413,
        details: {
          maxFileSizeBytes: this.options.maxFileSizeBytes,
          actualSizeBytes: input.data.byteLength,
        },
      });
    }

    const inspection = inspectFile(input.data);
    if (!inspection) {
      throw new AppError({
        code: "MEDIA_FILE_TYPE_UNSUPPORTED",
        message: "File signature is not supported",
        statusCode: 415,
      });
    }
    if (!this.options.allowedMimeTypes.has(inspection.mimeType)) {
      throw new AppError({
        code: "MEDIA_FILE_TYPE_NOT_ALLOWED",
        message: "File type is not allowed",
        statusCode: 415,
        details: { mimeType: inspection.mimeType },
      });
    }
    if (
      input.declaredMimeType &&
      input.declaredMimeType !== "application/octet-stream" &&
      input.declaredMimeType !== inspection.mimeType
    ) {
      throw new AppError({
        code: "MEDIA_MIME_MISMATCH",
        message: "Uploaded file content does not match its declared MIME type",
        statusCode: 415,
        details: {
          declaredMimeType: input.declaredMimeType,
          detectedMimeType: inspection.mimeType,
        },
      });
    }

    const title = normalizeOptionalText(input.title, 160, "title");
    const altText = normalizeOptionalText(input.altText, 500, "altText");
    if (altText !== null && inspection.kind !== "IMAGE") {
      throw new AppError({
        code: "MEDIA_ALT_TEXT_IMAGE_ONLY",
        message: "Alt text can only be assigned to image assets",
        statusCode: 400,
      });
    }

    const id = randomUUID();
    const storageKey = buildStorageKey(id, inspection.extension);
    const fileName = `${sanitizeStem(input.originalName)}-${id.slice(0, 8)}.${inspection.extension}`;

    await this.storage.write({ key: storageKey, data: input.data });
    try {
      const asset = await this.repository.create({
        originalName: normalizeOriginalName(input.originalName),
        fileName,
        storageProvider: this.storage.provider,
        storageKey,
        mimeType: inspection.mimeType,
        kind: inspection.kind,
        sizeBytes: input.data.byteLength,
        checksumSha256: inspection.checksumSha256,
        width: inspection.width,
        height: inspection.height,
        altText,
        title,
        metadata: input.metadata ?? null,
        uploadedByUserId: request.actorUserId,
      });
      await this.repository.audit({
        actorUserId: request.actorUserId,
        action: "media.asset.upload",
        targetId: asset.id,
        ...auditFields(request),
        metadata: {
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          checksumSha256: asset.checksumSha256,
        },
      });
      return asset;
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  list(input: MediaListInput): Promise<MediaPage> {
    return this.repository.list(input);
  }

  async get(id: string): Promise<MediaAsset> {
    const asset = await this.repository.findById(id);
    if (!asset) {
      throw new AppError({
        code: "MEDIA_ASSET_NOT_FOUND",
        message: "Media asset was not found",
        statusCode: 404,
      });
    }
    return asset;
  }

  async content(id: string): Promise<MediaContent> {
    const asset = await this.get(id);
    const data = await this.storage.read(asset.storageKey);
    return { asset, data };
  }

  async update(
    id: string,
    input: MediaUpdateInput,
    request: MediaRequestMetadata,
  ): Promise<MediaAsset> {
    const current = await this.get(id);
    const next: MediaUpdateInput = {
      ...(input.title === undefined
        ? {}
        : { title: normalizeOptionalText(input.title, 160, "title") }),
      ...(input.altText === undefined
        ? {}
        : { altText: normalizeOptionalText(input.altText, 500, "altText") }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    };

    if (current.kind !== "IMAGE" && next.altText !== undefined && next.altText !== null) {
      throw new AppError({
        code: "MEDIA_ALT_TEXT_IMAGE_ONLY",
        message: "Alt text can only be assigned to image assets",
        statusCode: 400,
      });
    }

    const asset = await this.repository.update(id, next);
    await this.repository.audit({
      actorUserId: request.actorUserId,
      action: "media.asset.update",
      targetId: id,
      ...auditFields(request),
    });
    return asset;
  }

  async delete(id: string, request: MediaRequestMetadata): Promise<void> {
    const asset = await this.get(id);
    await this.storage.delete(asset.storageKey);
    await this.repository.delete(id);
    await this.repository.audit({
      actorUserId: request.actorUserId,
      action: "media.asset.delete",
      targetId: id,
      ...auditFields(request),
      metadata: { storageKey: asset.storageKey },
    });
  }
}

function normalizeOriginalName(name: string): string {
  const cleaned = [...name.trim()]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join("");

  const base = path.basename(cleaned);
  if (!base) return "upload";
  return base.slice(0, 255);
}

function sanitizeStem(name: string): string {
  const base = normalizeOriginalName(name).replace(/\.[^.]+$/, "");
  const safe = base
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || "media";
}

function buildStorageKey(id: string, extension: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${id}.${extension}`;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
  field: string,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new AppError({
      code: "MEDIA_METADATA_INVALID",
      message: `Media ${field} is too long`,
      statusCode: 400,
      details: { field, maxLength },
    });
  }
  return trimmed;
}

function auditFields(request: MediaRequestMetadata): {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
    ...(request.ipAddress === undefined ? {} : { ipAddress: request.ipAddress }),
    ...(request.userAgent === undefined ? {} : { userAgent: request.userAgent }),
  };
}

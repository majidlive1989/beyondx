import { Prisma, type PrismaClient } from "@beyondx/database";
import { AppError } from "@beyondx/core";
import type {
  MediaCreateRecordInput,
  MediaRepository,
} from "../application/contracts.js";
import type {
  MediaAsset,
  MediaListInput,
  MediaPage,
  MediaUpdateInput,
} from "../domain/models.js";

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly database: PrismaClient) {}

  async create(input: MediaCreateRecordInput): Promise<MediaAsset> {
    const asset = await this.database.mediaAsset.create({
      data: {
        originalName: input.originalName,
        fileName: input.fileName,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        kind: input.kind,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        width: input.width,
        height: input.height,
        altText: input.altText,
        title: input.title,
        ...(input.metadata === undefined
          ? {}
          : { metadata: toJsonInput(input.metadata) }),
        uploadedByUserId: input.uploadedByUserId,
      },
    });
    return mapAsset(asset);
  }

  async findById(id: string): Promise<MediaAsset | null> {
    const asset = await this.database.mediaAsset.findUnique({ where: { id } });
    return asset ? mapAsset(asset) : null;
  }

  async list(input: MediaListInput): Promise<MediaPage> {
    const where: Prisma.MediaAssetWhereInput = {
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(input.mimeType === undefined ? {} : { mimeType: input.mimeType }),
      ...(input.search === undefined || input.search.length === 0
        ? {}
        : {
            OR: [
              { originalName: { contains: input.search, mode: "insensitive" } },
              { fileName: { contains: input.search, mode: "insensitive" } },
              { title: { contains: input.search, mode: "insensitive" } },
              { altText: { contains: input.search, mode: "insensitive" } },
            ],
          }),
    };

    const [items, total] = await this.database.$transaction([
      this.database.mediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.mediaAsset.count({ where }),
    ]);

    return {
      items: items.map(mapAsset),
      page: input.page,
      pageSize: input.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }

  async update(id: string, input: MediaUpdateInput): Promise<MediaAsset> {
    try {
      const asset = await this.database.mediaAsset.update({
        where: { id },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.altText === undefined ? {} : { altText: input.altText }),
          ...(input.metadata === undefined
            ? {}
            : { metadata: toJsonInput(input.metadata) }),
        },
      });
      return mapAsset(asset);
    } catch (error) {
      if (isNotFound(error)) {
        throw new AppError({
          code: "MEDIA_ASSET_NOT_FOUND",
          message: "Media asset was not found",
          statusCode: 404,
        });
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.database.mediaAsset.delete({ where: { id } });
    } catch (error) {
      if (isNotFound(error)) {
        throw new AppError({
          code: "MEDIA_ASSET_NOT_FOUND",
          message: "Media asset was not found",
          statusCode: 404,
        });
      }
      throw error;
    }
  }

  async audit(input: {
    actorUserId: string | null;
    action: string;
    targetId: string | null;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: "MediaAsset",
        targetId: input.targetId,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: toJsonInput(input.metadata ?? null),
      },
    });
  }
}

function mapAsset(asset: {
  id: string;
  originalName: string;
  fileName: string;
  storageProvider: string;
  storageKey: string;
  mimeType: string;
  kind: "IMAGE" | "FILE";
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  title: string | null;
  metadata: Prisma.JsonValue | null;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MediaAsset {
  return {
    ...asset,
    metadata: asRecord(asset.metadata),
  };
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (value === null || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function toJsonInput(
  value: Record<string, unknown> | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

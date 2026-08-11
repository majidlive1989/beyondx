import {
  AppError,
  type HttpRequestContext,
  type HttpRouteDefinition,
  type HttpUploadedFile,
} from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type { MediaService } from "../application/media-service.js";
import type { MediaAsset, MediaListInput, MediaUpdateInput } from "../domain/models.js";
import {
  getMediaVisibility,
  getUserMediaMetadata,
  type MediaVisibility,
} from "../domain/public-delivery.js";

const idParamsSchema = z.object({ id: z.string().min(1) });
const visibilityBodySchema = z.object({ visibility: z.enum(["PRIVATE", "PUBLIC"]) });

const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
    search: z.string().trim().max(160).optional(),
    kind: z.enum(["IMAGE", "FILE"]).optional(),
    mimeType: z.string().trim().max(120).optional(),
  })
  .transform(
    (value): MediaListInput => ({
      page: value.page,
      pageSize: value.pageSize,
      ...(value.search === undefined ? {} : { search: value.search }),
      ...(value.kind === undefined ? {} : { kind: value.kind }),
      ...(value.mimeType === undefined ? {} : { mimeType: value.mimeType }),
    }),
  );

const updateSchema = z
  .object({
    title: z.string().trim().max(160).nullable().optional(),
    altText: z.string().trim().max(500).nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one media field is required",
  })
  .transform(
    (value): MediaUpdateInput => ({
      ...(value.title === undefined ? {} : { title: value.title }),
      ...(value.altText === undefined ? {} : { altText: value.altText }),
      ...(value.metadata === undefined ? {} : { metadata: value.metadata }),
    }),
  );

export function createMediaRoutes(service: MediaService): HttpRouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/v1/media/:id",
      summary: "Read public media metadata",
      tags: ["Media"],
      public: true,
      schema: {
        params: idParamsJsonSchema,
        response: { 200: publicMediaEnvelopeSchema },
      },
      handler: async (context) => {
        const { id } = parseInput(idParamsSchema, context.params);
        const asset = await service.publicGet(id);
        return { body: { asset: publicDeliveryAsset(asset) } };
      },
    },
    {
      method: "GET",
      path: "/api/v1/media/:id/content",
      summary: "Deliver public media file content",
      tags: ["Media"],
      public: true,
      schema: { params: idParamsJsonSchema },
      handler: async (context) => {
        const { id } = parseInput(idParamsSchema, context.params);
        const { asset, data } = await service.publicContent(id);
        return {
          headers: {
            "content-type": asset.mimeType,
            "content-length": String(data.byteLength),
            "content-disposition": `inline; filename="${headerFileName(asset.fileName)}"`,
            "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
            "etag": `"sha256-${asset.checksumSha256}"`,
            "x-content-type-options": "nosniff",
            "cross-origin-resource-policy": "cross-origin",
          },
          body: Buffer.from(data),
        };
      },
    },
    protectedRoute(
      "GET",
      "/api/v1/admin/media",
      "List media library assets",
      "media.assets.read",
      async (context) => {
        const page = await service.list(parseInput(listSchema, context.query ?? {}));
        return {
          body: {
            ...page,
            items: page.items.map(publicAsset),
          },
        };
      },
      { querystring: listQueryJsonSchema, response: { 200: mediaPageSchema } },
    ),
    {
      method: "POST",
      path: "/api/v1/admin/media",
      summary: "Upload a media asset",
      tags: ["Media"],
      public: false,
      permission: "media.assets.upload",
      multipart: true,
      schema: {
        consumes: ["multipart/form-data"],
        body: multipartBodySchema,
        response: { 201: mediaAssetEnvelopeSchema },
      },
      handler: async (context) => {
        const file = requireFile(context.files?.file);
        const body = readMultipartFields(context.body);
        const asset = await service.upload(
          {
            originalName: file.filename,
            declaredMimeType: file.mimeType,
            data: file.data,
            ...(body.title === undefined ? {} : { title: body.title }),
            ...(body.altText === undefined ? {} : { altText: body.altText }),
            ...(body.metadata === undefined ? {} : { metadata: body.metadata }),
            ...(body.visibility === undefined ? {} : { visibility: body.visibility }),
          },
          requestMetadata(context),
        );
        return { statusCode: 201, body: { asset: publicAsset(asset) } };
      },
    },
    protectedRoute(
      "GET",
      "/api/v1/admin/media/:id",
      "Read a media asset",
      "media.assets.read",
      async (context) => {
        const { id } = parseInput(idParamsSchema, context.params);
        return { body: { asset: publicAsset(await service.get(id)) } };
      },
      { params: idParamsJsonSchema, response: { 200: mediaAssetEnvelopeSchema } },
    ),
    protectedRoute(
      "PATCH",
      "/api/v1/admin/media/:id",
      "Update media metadata",
      "media.assets.update",
      async (context) => {
        const { id } = parseInput(idParamsSchema, context.params);
        const asset = await service.update(
          id,
          parseInput(updateSchema, context.body),
          requestMetadata(context),
        );
        return { body: { asset: publicAsset(asset) } };
      },
      {
        params: idParamsJsonSchema,
        body: updateBodyJsonSchema,
        response: { 200: mediaAssetEnvelopeSchema },
      },
    ),
    protectedRoute(
      "PATCH",
      "/api/v1/admin/media/:id/visibility",
      "Set media public visibility",
      "media.assets.update",
      async (context) => {
        const { id } = parseInput(idParamsSchema, context.params);
        const { visibility } = parseInput(visibilityBodySchema, context.body);
        const asset = await service.setVisibility(
          id,
          visibility,
          requestMetadata(context),
        );
        return { body: { asset: publicAsset(asset) } };
      },
      {
        params: idParamsJsonSchema,
        body: visibilityBodyJsonSchema,
        response: { 200: mediaAssetEnvelopeSchema },
      },
    ),
    protectedRoute(
      "GET",
      "/api/v1/admin/media/:id/content",
      "Download or preview media file content",
      "media.assets.read",
      async (context) => {
        const { id } = parseInput(idParamsSchema, context.params);
        const { asset, data } = await service.content(id);
        return {
          headers: {
            "content-type": asset.mimeType,
            "content-length": String(data.byteLength),
            "content-disposition": `inline; filename="${headerFileName(asset.fileName)}"`,
            "cache-control": "private, max-age=300",
          },
          body: Buffer.from(data),
        };
      },
      { params: idParamsJsonSchema },
    ),
    protectedRoute(
      "DELETE",
      "/api/v1/admin/media/:id",
      "Delete a media asset",
      "media.assets.delete",
      async (context) => {
        const { id } = parseInput(idParamsSchema, context.params);
        await service.delete(id, requestMetadata(context));
        return { statusCode: 204, body: null };
      },
      { params: idParamsJsonSchema },
    ),
  ];
}

function protectedRoute(
  method: HttpRouteDefinition["method"],
  path: string,
  summary: string,
  permission: string,
  handler: HttpRouteDefinition["handler"],
  schema?: Record<string, unknown>,
): HttpRouteDefinition {
  return {
    method,
    path,
    summary,
    tags: ["Media"],
    public: false,
    permission,
    ...(schema === undefined ? {} : { schema }),
    handler,
  };
}

function requestMetadata(context: HttpRequestContext) {
  const userAgent = readHeader(context, "user-agent");
  return {
    actorUserId: requirePrincipal(context),
    requestId: context.requestId,
    ipAddress: context.ip,
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

function requirePrincipal(context: HttpRequestContext): string {
  if (!context.principal) {
    throw new AppError({
      code: "IDENTITY_AUTHENTICATION_REQUIRED",
      message: "Authentication is required",
      statusCode: 401,
    });
  }
  return context.principal.subject;
}

function requireFile(file: HttpUploadedFile | undefined): HttpUploadedFile {
  if (!file) {
    throw new AppError({
      code: "MEDIA_FILE_REQUIRED",
      message: "A multipart file field named 'file' is required",
      statusCode: 400,
    });
  }
  return file;
}

function readMultipartFields(body: unknown): {
  title?: string;
  altText?: string;
  metadata?: Record<string, unknown> | null;
  visibility?: MediaVisibility;
} {
  const record = asRecord(body);
  const title = readString(record.title);
  const altText = readString(record.altText);
  const metadataRaw = readString(record.metadata);
  const visibility = readVisibility(record.visibility);
  let metadata: Record<string, unknown> | null | undefined;
  if (metadataRaw !== undefined && metadataRaw !== "") {
    try {
      const parsed: unknown = JSON.parse(metadataRaw);
      if (parsed === null) metadata = null;
      else if (typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      } else {
        throw new Error("metadata must be an object");
      }
    } catch {
      throw new AppError({
        code: "MEDIA_METADATA_INVALID",
        message: "Multipart metadata must be a JSON object",
        statusCode: 400,
      });
    }
  }
  return {
    ...(title === undefined ? {} : { title }),
    ...(altText === undefined ? {} : { altText }),
    ...(metadata === undefined ? {} : { metadata }),
    ...(visibility === undefined ? {} : { visibility }),
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readVisibility(value: unknown): MediaVisibility | undefined {
  const text = readString(value);
  if (text === undefined || text === "") return undefined;
  if (text === "PRIVATE" || text === "PUBLIC") return text;
  throw new AppError({
    code: "MEDIA_VISIBILITY_INVALID",
    message: "Media visibility must be PRIVATE or PUBLIC",
    statusCode: 400,
  });
}

function readHeader(context: HttpRequestContext, name: string): string | undefined {
  const value = context.headers[name];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function headerFileName(value: string): string {
  return value.replace(/["\r\n\\]/g, "_");
}

function publicAsset(asset: MediaAsset) {
  const visibility = getMediaVisibility(asset);
  return {
    ...asset,
    metadata: getUserMediaMetadata(asset.metadata),
    visibility,
    contentUrl: visibility === "PUBLIC" ? publicContentUrl(asset.id) : null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function publicDeliveryAsset(asset: MediaAsset) {
  return {
    id: asset.id,
    originalName: asset.originalName,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    kind: asset.kind,
    sizeBytes: asset.sizeBytes,
    checksumSha256: asset.checksumSha256,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
    title: asset.title,
    metadata: getUserMediaMetadata(asset.metadata),
    visibility: "PUBLIC" as const,
    contentUrl: publicContentUrl(asset.id),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function publicContentUrl(id: string): string {
  return `/api/v1/media/${encodeURIComponent(id)}/content`;
}

const idParamsJsonSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", minLength: 1 } },
};

const listQueryJsonSchema = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100, default: 24 },
    search: { type: "string", maxLength: 160 },
    kind: { type: "string", enum: ["IMAGE", "FILE"] },
    mimeType: { type: "string", maxLength: 120 },
  },
};

const multipartField = (maxLength: number) => ({
  type: "object",
  properties: { value: { type: "string", maxLength } },
});

const multipartBodySchema = {
  type: "object",
  required: ["file"],
  properties: {
    file: { isFile: true },
    title: multipartField(160),
    altText: multipartField(500),
    metadata: multipartField(10_000),
    visibility: multipartField(16),
  },
};

const updateBodyJsonSchema = {
  type: "object",
  minProperties: 1,
  properties: {
    title: { anyOf: [{ type: "string", maxLength: 160 }, { type: "null" }] },
    altText: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
    metadata: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
  },
};

const visibilityBodyJsonSchema = {
  type: "object",
  required: ["visibility"],
  additionalProperties: false,
  properties: {
    visibility: { type: "string", enum: ["PRIVATE", "PUBLIC"] },
  },
};

const mediaAssetSchema = {
  type: "object",
  required: [
    "id",
    "originalName",
    "fileName",
    "storageProvider",
    "mimeType",
    "kind",
    "sizeBytes",
    "checksumSha256",
    "width",
    "height",
    "altText",
    "title",
    "metadata",
    "uploadedByUserId",
    "createdAt",
    "updatedAt",
    "visibility",
    "contentUrl",
  ],
  properties: {
    id: { type: "string" },
    originalName: { type: "string" },
    fileName: { type: "string" },
    storageProvider: { type: "string" },
    mimeType: { type: "string" },
    kind: { type: "string", enum: ["IMAGE", "FILE"] },
    sizeBytes: { type: "integer" },
    checksumSha256: { type: "string" },
    width: { anyOf: [{ type: "integer" }, { type: "null" }] },
    height: { anyOf: [{ type: "integer" }, { type: "null" }] },
    altText: { anyOf: [{ type: "string" }, { type: "null" }] },
    title: { anyOf: [{ type: "string" }, { type: "null" }] },
    metadata: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
    uploadedByUserId: { anyOf: [{ type: "string" }, { type: "null" }] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    visibility: { type: "string", enum: ["PRIVATE", "PUBLIC"] },
    contentUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
};

const mediaAssetEnvelopeSchema = {
  type: "object",
  required: ["asset"],
  properties: { asset: mediaAssetSchema },
};


const publicMediaAssetSchema = {
  type: "object",
  required: [
    "id", "originalName", "fileName", "mimeType", "kind", "sizeBytes",
    "checksumSha256", "width", "height", "altText", "title", "metadata",
    "visibility", "contentUrl", "createdAt", "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    originalName: { type: "string" },
    fileName: { type: "string" },
    mimeType: { type: "string" },
    kind: { type: "string", enum: ["IMAGE", "FILE"] },
    sizeBytes: { type: "integer" },
    checksumSha256: { type: "string" },
    width: { anyOf: [{ type: "integer" }, { type: "null" }] },
    height: { anyOf: [{ type: "integer" }, { type: "null" }] },
    altText: { anyOf: [{ type: "string" }, { type: "null" }] },
    title: { anyOf: [{ type: "string" }, { type: "null" }] },
    metadata: { anyOf: [{ type: "object", additionalProperties: true }, { type: "null" }] },
    visibility: { type: "string", const: "PUBLIC" },
    contentUrl: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const publicMediaEnvelopeSchema = {
  type: "object",
  required: ["asset"],
  properties: { asset: publicMediaAssetSchema },
};

const mediaPageSchema = {
  type: "object",
  required: ["items", "page", "pageSize", "total", "pageCount"],
  properties: {
    items: { type: "array", items: mediaAssetSchema },
    page: { type: "integer" },
    pageSize: { type: "integer" },
    total: { type: "integer" },
    pageCount: { type: "integer" },
  },
};

import {
  AppError,
  type HttpRouteRegistry,
  type HttpUploadedFile,
} from "@beyondx/core";
import type { BeyondXFastifyInstance } from "./types.js";

export function registerModuleRoutes(
  app: BeyondXFastifyInstance,
  routes: HttpRouteRegistry,
): void {
  for (const route of routes.list()) {
    app.route({
      method: route.method,
      url: route.path,
      config: {
        beyondxPublic: route.public,
      },
      schema: {
        tags: route.tags,
        summary: route.summary,
        security: route.public ? [] : [{ bearerAuth: [] }],
        ...(route.schema ?? {}),
      },
      handler: async (request, reply) => {
        if (!route.public) {
          if (!request.principal) {
            throw new AppError({
              code: "IDENTITY_AUTHENTICATION_REQUIRED",
              message: "Authentication is required",
              statusCode: 401,
            });
          }
          if (route.permission && !request.principal.permissions.has(route.permission)) {
            throw new AppError({
              code: "IDENTITY_PERMISSION_DENIED",
              message: "You do not have permission to perform this action",
              statusCode: 403,
              details: { permission: route.permission },
            });
          }
        }

        const multipart = route.multipart
          ? await normalizeMultipartBody(request.body)
          : undefined;
        const response = await route.handler({
          requestId: request.id,
          ip: request.ip,
          params: request.params,
          query: request.query,
          body: multipart?.body ?? request.body,
          headers: request.headers,
          ...(request.principal ? { principal: request.principal } : {}),
          ...(multipart === undefined || Object.keys(multipart.files).length === 0
            ? {}
            : { files: multipart.files }),
        });
        for (const [name, value] of Object.entries(response.headers ?? {})) {
          reply.header(name, value);
        }
        return reply.status(response.statusCode ?? 200).send(response.body);
      },
    });
  }
}

async function normalizeMultipartBody(
  body: unknown,
): Promise<{
  body: Record<string, unknown>;
  files: Record<string, HttpUploadedFile>;
}> {
  const fields: Record<string, unknown> = {};
  const files: Record<string, HttpUploadedFile> = {};
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { body: fields, files };
  }

  for (const [key, raw] of Object.entries(body)) {
    if (isMultipartFile(raw)) {
      files[key] = {
        fieldName: raw.fieldname,
        filename: raw.filename,
        encoding: raw.encoding,
        mimeType: raw.mimetype,
        data: await raw.toBuffer(),
      };
      continue;
    }
    if (isMultipartField(raw)) {
      fields[key] = raw.value;
      continue;
    }
    fields[key] = raw;
  }

  return { body: fields, files };
}

interface MultipartFileLike {
  fieldname: string;
  filename: string;
  encoding: string;
  mimetype: string;
  toBuffer(): Promise<Buffer>;
}

function isMultipartFile(value: unknown): value is MultipartFileLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MultipartFileLike>;
  return (
    typeof candidate.fieldname === "string" &&
    typeof candidate.filename === "string" &&
    typeof candidate.encoding === "string" &&
    typeof candidate.mimetype === "string" &&
    typeof candidate.toBuffer === "function"
  );
}

function isMultipartField(value: unknown): value is { value: unknown } {
  return typeof value === "object" && value !== null && "value" in value;
}

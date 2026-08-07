import { AppError } from "@beyondx/core";
import type { FastifyRequest } from "fastify";

export type PermissionRequest = Pick<FastifyRequest, "principal">;

export function requirePermission(
  permission: string,
): (request: PermissionRequest) => Promise<void> {
  return (request: PermissionRequest): Promise<void> => {
    if (!request.principal) {
      return Promise.reject(
        new AppError({
          code: "IDENTITY_AUTHENTICATION_REQUIRED",
          message: "Authentication is required",
          statusCode: 401,
        }),
      );
    }

    if (!request.principal.permissions.has(permission)) {
      return Promise.reject(
        new AppError({
          code: "IDENTITY_PERMISSION_DENIED",
          message: "You do not have permission to perform this action",
          statusCode: 403,
          details: { permission },
        }),
      );
    }

    return Promise.resolve();
  };
}

import { AppError } from "@beyondx/core";
import type { BeyondXFastifyInstance } from "./types.js";

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function readHttpStatusCode(error: unknown): number | undefined {
  const statusCode = asRecord(error).statusCode;
  return typeof statusCode === "number" && Number.isInteger(statusCode)
    ? statusCode
    : undefined;
}

function hasValidationDetails(error: unknown): boolean {
  return asRecord(error).validation !== undefined;
}

export function registerGlobalErrorHandler(app: BeyondXFastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: {
        code: "HTTP_ROUTE_NOT_FOUND",
        message: "Route not found",
        requestId: request.id,
      },
    } satisfies ErrorResponse),
  );

  app.setErrorHandler((error: unknown, request, reply) => {
    const appError = error instanceof AppError ? error : undefined;
    const isValidation = hasValidationDetails(error);
    const reportedStatusCode = readHttpStatusCode(error);
    const clientStatusCode =
      reportedStatusCode !== undefined &&
      reportedStatusCode >= 400 &&
      reportedStatusCode < 500
        ? reportedStatusCode
        : undefined;

    const statusCode =
      appError?.statusCode ?? (isValidation ? 400 : (clientStatusCode ?? 500));
    const code =
      appError?.code ??
      (statusCode === 413
        ? "MEDIA_FILE_TOO_LARGE"
        : isValidation
          ? "VALIDATION_INVALID_REQUEST"
          : "CORE_INTERNAL_ERROR");
    const message =
      appError?.message ??
      (statusCode === 413
        ? "Uploaded file exceeds the configured size limit"
        : isValidation
          ? "Request validation failed"
          : "An unexpected error occurred");

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id, code }, message);
    } else {
      request.log.warn({ err: error, requestId: request.id, code }, message);
    }

    const response: ErrorResponse = {
      error: {
        code,
        message,
        requestId: request.id,
        ...(appError?.details ? { details: appError.details } : {}),
      },
    };

    return reply.status(statusCode).send(response);
  });
}

import { AppError } from "@beyondx/core";
import type { ZodType, ZodTypeDef } from "zod";

export function parseInput<TOutput, TDef extends ZodTypeDef, TInput>(
  schema: ZodType<TOutput, TDef, TInput>,
  input: unknown,
  code = "VALIDATION_INVALID_INPUT",
): TOutput {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError({
      code,
      message: "Input validation failed",
      statusCode: 400,
      details: {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
      },
    });
  }

  return result.data;
}
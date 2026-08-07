import { ConfigurationError } from "@beyondx/core";
import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value: string) => value === "true");
const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("BeyondX"),
  APP_URL: z.string().url().default("http://localhost:4000"),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1), REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32), JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(2).default("15m"), JWT_REFRESH_EXPIRES_IN: z.string().min(2).default("30d"),
  PASSWORD_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  ADMIN_URL: z.string().url().default("http://localhost:3000"),
  EMAIL_VERIFICATION_EXPIRES_IN: z.string().min(2).default("24h"),
  PASSWORD_RESET_EXPIRES_IN: z.string().min(2).default("1h"),
  REFRESH_COOKIE_NAME: z.string().min(1).default("beyondx_refresh"),
  REFRESH_COOKIE_SECURE: booleanString.default("false"),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  ADMIN_EMAIL: z.string().email(), ADMIN_PASSWORD: z.string().min(12), ADMIN_FIRST_NAME: z.string().min(1), ADMIN_LAST_NAME: z.string().min(1),
  CORS_ORIGIN: z.string().transform((value: string) => value.split(",").map((origin: string) => origin.trim()).filter(Boolean)),
  SMTP_HOST: z.string().min(1), SMTP_PORT: z.coerce.number().int().min(1).max(65535), SMTP_SECURE: booleanString, SMTP_FROM: z.string().email(),
  OPENAPI_ENABLED: booleanString.default("true"), OPENAPI_ROUTE: z.string().startsWith("/").default("/openapi.json"), DOCS_ROUTE: z.string().startsWith("/").default("/docs"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100), RATE_LIMIT_WINDOW: z.string().min(1).default("1 minute"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
});
export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) throw new ConfigurationError("Environment validation failed", { issues: parsed.error.issues.map((issue: { path: Array<string | number>; message: string }) => ({ path: issue.path.join("."), message: issue.message })) });
  return Object.freeze(parsed.data);
}
export { environmentSchema };

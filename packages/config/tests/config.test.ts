import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/index.js";
const valid = { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/beyondx", REDIS_URL: "redis://localhost:6379", JWT_ACCESS_SECRET: "a".repeat(32), JWT_REFRESH_SECRET: "b".repeat(32), ADMIN_EMAIL: "admin@beyondx.local", ADMIN_PASSWORD: "ChangeMe123!", ADMIN_FIRST_NAME: "BeyondX", ADMIN_LAST_NAME: "Admin", CORS_ORIGIN: "http://localhost:3000", SMTP_HOST: "localhost", SMTP_PORT: "1025", SMTP_SECURE: "false", SMTP_FROM: "no-reply@beyondx.local" };
describe("loadConfig", () => {
  it("normalizes numeric, boolean and list values", () => {
    const config = loadConfig({ ...valid, API_PORT: "4100", OPENAPI_ENABLED: "false", CORS_ORIGIN: "http://a.local,http://b.local" });
    expect(config.API_PORT).toBe(4100); expect(config.OPENAPI_ENABLED).toBe(false); expect(config.CORS_ORIGIN).toHaveLength(2);
  });
  it("rejects short secrets", () => expect(() => loadConfig({ ...valid, JWT_ACCESS_SECRET: "short" })).toThrow(/Environment validation failed/));
});

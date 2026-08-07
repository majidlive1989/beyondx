import { describe, expect, it } from "vitest";
import { requirePermission } from "../src/security.js";

describe("permission guard", () => {
  it("rejects anonymous requests", async () => {
    const guard = requirePermission("monitoring.overview.read");

    await expect(guard({})).rejects.toMatchObject({
      code: "IDENTITY_AUTHENTICATION_REQUIRED",
      statusCode: 401,
    });
  });

  it("accepts a principal with the required permission", async () => {
    const guard = requirePermission("monitoring.overview.read");

    await expect(
      guard({
        principal: {
          subject: "user-1",
          permissions: new Set(["monitoring.overview.read"]),
        },
      }),
    ).resolves.toBeUndefined();
  });
});

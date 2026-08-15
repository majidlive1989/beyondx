import { describe, expect, it, vi } from "vitest";
import { createSchemaRoutes } from "../src/api/routes.js";
import type { SchemaService } from "../src/application/schema-service.js";

describe("Public contact form delivery", () => {
  it("creates a private inbox record with NEW/DRAFT status", async () => {
    const createRecord = vi.fn().mockResolvedValue({ id: "submission-1" });
    const routes = createSchemaRoutes({ createRecord } as unknown as SchemaService);
    const route = routes.find((candidate) => candidate.method === "POST" && candidate.path === "/api/v1/forms/contact");
    expect(route).toBeDefined();

    const response = await route!.handler({
      body: {
        name: "Ali Example",
        email: "ali@example.com",
        phone: "+971500000000",
        subject: "Project question",
        message: "Please contact me about BeyondX.",
        locale: "en",
        pageUrl: "/contact",
      },
      headers: { "user-agent": "vitest" },
      requestId: "request-1",
      ip: "127.0.0.1",
    } as never);

    expect(response).toMatchObject({ statusCode: 201, body: { submitted: true } });
    expect(createRecord).toHaveBeenCalledWith(
      "contact-submission",
      {
        status: "DRAFT",
        values: {
          name: "Ali Example",
          email: "ali@example.com",
          phone: "+971500000000",
          subject: "Project question",
          message: "Please contact me about BeyondX.",
          locale: "en",
          pageUrl: "/contact",
        },
      },
      null,
      {
        actorUserId: null,
        requestId: "request-1",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    );
  });

  it("accepts a filled honeypot without creating a record", async () => {
    const createRecord = vi.fn();
    const routes = createSchemaRoutes({ createRecord } as unknown as SchemaService);
    const route = routes.find((candidate) => candidate.method === "POST" && candidate.path === "/api/v1/forms/contact");

    const response = await route!.handler({
      body: {
        name: "Bot",
        email: "bot@example.com",
        message: "Spam",
        website: "https://spam.example",
      },
      headers: {},
    } as never);

    expect(response).toMatchObject({ statusCode: 202, body: { submitted: true } });
    expect(createRecord).not.toHaveBeenCalled();
  });
});

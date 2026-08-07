import { describe, expect, it } from "vitest";
import { createCapturingLogger, eventually } from "../src/index.js";
describe("testing utilities", () => { it("captures structured logs", () => { const { logger, logs } = createCapturingLogger(); logger.info({ requestId: "1" }, "ready"); expect(logs[0]).toMatchObject({ level: "info", message: "ready" }); }); it("retries assertions", async () => { let value = 0; setTimeout(() => { value = 1; }, 5); await eventually(() => expect(value).toBe(1)); }); });

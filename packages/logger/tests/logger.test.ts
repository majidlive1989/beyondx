import { describe, expect, it } from "vitest";
import { createLogger } from "../src/index.js";
describe("createLogger", () => { it("creates a structured logger", () => { const logger = createLogger({ level: "silent", service: "test", environment: "test" }); expect(logger.level).toBe("silent"); expect(typeof logger.info).toBe("function"); }); });

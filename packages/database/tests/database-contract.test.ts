import { describe, expect, it } from "vitest";
import { PrismaClient } from "../src/index.js";
describe("database package", () => { it("exports the generated Prisma client contract", () => expect(typeof PrismaClient).toBe("function")); });

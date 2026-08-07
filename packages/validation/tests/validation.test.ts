import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseInput } from "../src/index.js";
describe("parseInput", () => { it("returns parsed data", () => expect(parseInput(z.object({ count: z.coerce.number() }), { count: "2" })).toEqual({ count: 2 })); it("throws a structured application error", () => expect(() => parseInput(z.string().email(), "invalid")).toThrow(/Input validation failed/)); });

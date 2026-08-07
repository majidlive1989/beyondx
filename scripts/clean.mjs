import { rm } from "node:fs/promises";
import { glob } from "node:fs/promises";

for await (const entry of glob(["apps/*/dist", "packages/*/dist", "modules/*/dist", "coverage", ".turbo"])) {
  await rm(entry, { recursive: true, force: true });
}

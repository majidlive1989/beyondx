import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const targets = [
  "apps/storefront",
  "PHASE5C-NEXT-INTEGRATION-README.md",
  "PHASE5C-FIX1-README.md",
];

for (const target of targets) {
  const path = resolve(root, target);
  if (!existsSync(path)) {
    console.log(`Already absent: ${target}`);
    continue;
  }
  rmSync(path, { recursive: true, force: true });
  console.log(`Removed: ${target}`);
}

console.log("Phase 5C.6 cleanup complete. Run pnpm install to refresh the workspace lockfile.");

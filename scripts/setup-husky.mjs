import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".git")) {
  console.log("Husky setup skipped because this directory is not a Git checkout.");
  process.exit(0);
}

const result = spawnSync("husky", [], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);

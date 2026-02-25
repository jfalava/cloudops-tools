import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(scriptsDir, "..", "package.json");
const backupPath = resolve(scriptsDir, "..", ".package.json.prepack-backup");

if (!existsSync(backupPath)) {
  process.exit(0);
}

writeFileSync(packageJsonPath, readFileSync(backupPath, "utf8"));
unlinkSync(backupPath);

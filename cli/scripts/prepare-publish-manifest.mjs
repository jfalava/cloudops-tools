import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(scriptsDir, "..", "package.json");
const backupPath = resolve(scriptsDir, "..", ".package.json.prepack-backup");

const originalRaw = readFileSync(packageJsonPath, "utf8");
const pkg = JSON.parse(originalRaw);

if (typeof pkg.version !== "string") {
  throw new Error("cli/package.json is missing a string version");
}

const optionalDependencies =
  typeof pkg.optionalDependencies === "object" && pkg.optionalDependencies !== null
    ? pkg.optionalDependencies
    : {};

let changed = false;

for (const [name, value] of Object.entries(optionalDependencies)) {
  if (!name.startsWith("@cloudops-tools/cli-")) {
    continue;
  }

  if (typeof value === "string" && value.startsWith("workspace:")) {
    optionalDependencies[name] = pkg.version;
    changed = true;
  }
}

if (!changed) {
  process.exit(0);
}

if (!existsSync(backupPath)) {
  writeFileSync(backupPath, originalRaw);
}

const serialized = JSON.stringify(pkg, null, 2);

if (typeof serialized !== "string") {
  throw new Error("Failed to serialize cli/package.json");
}

writeFileSync(packageJsonPath, serialized + "\n");

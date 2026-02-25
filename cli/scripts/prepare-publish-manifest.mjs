import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {Record<string, string>} StringMap
 */

/**
 * @typedef {{
 *   version: string;
 *   optionalDependencies?: StringMap;
 *   [key: string]: unknown;
 * }} CliPackageJson
 */

/**
 * @param {unknown} value
 * @returns {value is CliPackageJson}
 */
function isCliPackageJson(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybePkg = /** @type {Record<string, unknown>} */ (value);

  if (typeof maybePkg.version !== "string") {
    return false;
  }

  if (maybePkg.optionalDependencies === undefined) {
    return true;
  }

  if (typeof maybePkg.optionalDependencies !== "object" || maybePkg.optionalDependencies === null) {
    return false;
  }

  return Object.values(maybePkg.optionalDependencies).every(
    (depVersion) => typeof depVersion === "string",
  );
}

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(scriptsDir, "..", "package.json");
const backupPath = resolve(scriptsDir, "..", ".package.json.prepack-backup");

const originalRaw = readFileSync(packageJsonPath, "utf8");
const parsed = /** @type {unknown} */ (JSON.parse(originalRaw));

if (!isCliPackageJson(parsed)) {
  throw new Error("cli/package.json is not the expected shape");
}

const pkg = parsed;

const optionalDependencies = pkg.optionalDependencies ?? {};

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

// Always refresh the backup so a stale file from an interrupted prior run
// cannot be restored over newer package.json edits during postpack.
writeFileSync(backupPath, originalRaw);

const serialized = JSON.stringify(pkg, null, 2);

writeFileSync(packageJsonPath, serialized + "\n");

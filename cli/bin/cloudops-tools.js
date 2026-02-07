#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";

const PLATFORMS = {
  "darwin-arm64": { pkg: "@cloudops-tools/cli-darwin-arm64", bin: "cloudops-tools" },
  "linux-x64": { pkg: "@cloudops-tools/cli-linux-x64", bin: "cloudops-tools" },
  "win32-x64": { pkg: "@cloudops-tools/cli-win32-x64", bin: "cloudops-tools.exe" },
};

const platformKey = `${process.platform}-${process.arch}`;

if (!(platformKey in PLATFORMS)) {
  console.error(
    `cloudops-tools: unsupported platform ${process.platform}/${process.arch}.\n` +
      `Supported: ${Object.keys(PLATFORMS).join(", ")}`,
  );
  process.exit(1);
}

const platform = PLATFORMS[/** @type {keyof typeof PLATFORMS} */ (platformKey)];

let binaryPath;
try {
  const require = createRequire(import.meta.url);
  const pkgDir = dirname(require.resolve(`${platform.pkg}/package.json`));
  binaryPath = resolve(pkgDir, platform.bin);
} catch {
  console.error(
    `cloudops-tools: could not find package "${platform.pkg}".\n` +
      "Make sure optional dependencies are installed (do not use --no-optional).",
  );
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

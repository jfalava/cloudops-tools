#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const binaryName = process.platform === "win32" ? "cloudops-tools.exe" : "cloudops-tools";
const binaryPath = resolve(here, "..", "dist-native", binaryName);

if (!existsSync(binaryPath)) {
  console.error("cloudops-tools native binary not found.");
  console.error("Reinstall the package or set CLOUDOPS_TOOLS_SKIP_NATIVE_INSTALL=0 and retry.");
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

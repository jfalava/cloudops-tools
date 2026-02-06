#!/usr/bin/env node
/* eslint-disable no-console */

import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { get } from "node:https";

const here = dirname(fileURLToPath(import.meta.url));
const cliDir = resolve(here, "..");
const repoRoot = resolve(cliDir, "..");
const pkgJsonPath = resolve(cliDir, "package.json");
const distDir = resolve(cliDir, "dist-native");

const shouldSkipInstall = () => {
  if (process.env.CLOUDOPS_TOOLS_SKIP_NATIVE_INSTALL === "1") {
    return true;
  }

  // Do not auto-download when working from the monorepo checkout.
  if (existsSync(resolve(repoRoot, ".git")) && process.env.CLOUDOPS_TOOLS_FORCE_NATIVE_INSTALL !== "1") {
    return true;
  }

  return false;
};

const platformAssetName = () => {
  if (process.platform === "linux" && process.arch === "x64") {
    return "cloudops-tools-linux-x64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "cloudops-tools-windows-x64.exe";
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "cloudops-tools-macos-arm64";
  }

  throw new Error(
    `Unsupported platform for prebuilt binary: ${process.platform}/${process.arch}. ` +
      "Build from source or use a supported platform.",
  );
};

const readVersion = () => {
  const packageJsonText = readFileSync(pkgJsonPath, "utf8");
  const versionMatch = packageJsonText.match(/"version"\s*:\s*"([^"]+)"/);
  const version = versionMatch?.[1];
  if (!version) {
    throw new Error("Failed to read package version from package.json");
  }
  return version;
};

const downloadToFile = (url, outputPath) =>
  new Promise((resolvePromise, rejectPromise) => {
    const request = get(
      url,
      {
        headers: {
          "User-Agent": "cloudops-tools-cli-installer",
          Accept: "application/octet-stream",
        },
      },
      async (response) => {
        const statusCode = response.statusCode ?? 0;

        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          const location = response.headers.location;
          response.resume();
          if (!location) {
            rejectPromise(new Error(`Redirect without location for ${url}`));
            return;
          }
          try {
            await downloadToFile(location, outputPath);
            resolvePromise();
          } catch (error) {
            rejectPromise(error);
          }
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          rejectPromise(new Error(`HTTP ${statusCode} while downloading ${url}`));
          return;
        }

        const file = createWriteStream(outputPath);
        try {
          await pipeline(response, file);
          resolvePromise();
        } catch (error) {
          rejectPromise(error);
        }
      },
    );

    request.on("error", rejectPromise);
  });

const install = async () => {
  if (shouldSkipInstall()) {
    console.log("[cloudops-tools] Skipping native binary install in local workspace.");
    return;
  }

  mkdirSync(distDir, { recursive: true });

  const version = readVersion();
  const repo = process.env.CLOUDOPS_TOOLS_GITHUB_REPO ?? "jfalava/cloudops-tools-draft";
  const assetName = platformAssetName();
  const targetName = process.platform === "win32" ? "cloudops-tools.exe" : "cloudops-tools";
  const targetPath = resolve(distDir, targetName);

  const candidateTags = [`v${version}`, version];
  let lastError;

  for (const tag of candidateTags) {
    const assetUrl = `https://github.com/${repo}/releases/download/${tag}/${assetName}`;
    try {
      rmSync(targetPath, { force: true });
      await downloadToFile(assetUrl, targetPath);

      if (process.platform !== "win32") {
        chmodSync(targetPath, 0o755);
      }

      console.log(`[cloudops-tools] Installed native binary from ${assetUrl}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `[cloudops-tools] Failed to download native binary for version ${version}. ` +
      `Last error: ${String(lastError)}`,
  );
};

install().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
